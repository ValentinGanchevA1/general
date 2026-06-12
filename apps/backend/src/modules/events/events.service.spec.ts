import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { EventsService } from './events.service';

/** A queryRunner whose query() drains a pre-seeded result queue (FIFO). */
function makeQueryRunner(results: unknown[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return Promise.resolve(results.shift() ?? []);
  });
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query,
  };
  return { runner, query, calls };
}

describe('EventsService', () => {
  let service: EventsService;
  let query: jest.Mock;
  let createQueryRunner: jest.Mock;

  async function build(): Promise<void> {
    query = jest.fn().mockResolvedValue([]);
    createQueryRunner = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getDataSourceToken(),
          useValue: { query, createQueryRunner } as unknown as DataSource,
        },
      ],
    }).compile();
    service = mod.get(EventsService);
  }

  beforeEach(build);

  const future = new Date(Date.now() + 86_400_000).toISOString();
  const loc = { lat: 43.2, lng: 27.9 };

  describe('create', () => {
    it('rejects a start time in the past', async () => {
      await expect(
        service.create('h1', {
          title: 'X',
          startsAt: new Date(Date.now() - 1000).toISOString(),
          location: loc,
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(query).not.toHaveBeenCalled();
    });

    it('rejects an end time before the start time', async () => {
      await expect(
        service.create('h1', {
          title: 'X',
          startsAt: future,
          endsAt: new Date(Date.parse(future) - 1000).toISOString(),
          location: loc,
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('inserts the event and returns a summary', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'e1', host_id: 'h1', title: 'X', description: null, cover_url: null,
          starts_at: new Date(future), ends_at: null, capacity: null,
          attendee_count: 0, visibility: 'public', lat: 43.2, lng: 27.9,
        },
      ]);
      const res = await service.create('h1', { title: 'X', startsAt: future, location: loc } as never);
      expect(res).toMatchObject({ id: 'e1', hostId: 'h1', attendeeCount: 0, myRsvp: null });
      expect(res.location).toEqual(loc);
    });
  });

  describe('rsvp', () => {
    it('rejects when the event is at capacity and the user is newly going', async () => {
      const { runner } = makeQueryRunner([
        [{ id: 'e1', host_id: 'h1', capacity: 2, visibility: 'public' }], // SELECT ... FOR UPDATE
        [], // existing attendee row (none)
        [{ going: 2 }], // current going count
      ]);
      createQueryRunner.mockReturnValue(runner);

      await expect(
        service.rsvp('u1', 'e1', { status: 'going' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('upserts the RSVP and returns the refreshed count', async () => {
      const { runner } = makeQueryRunner([
        [{ id: 'e1', host_id: 'h1', capacity: null, visibility: 'public' }],
        [], // no existing row
        // capacity null -> skips the going-count check
        [], // INSERT ... ON CONFLICT
        [{ count: 5 }], // UPDATE events ... RETURNING attendee_count
      ]);
      createQueryRunner.mockReturnValue(runner);

      const res = await service.rsvp('u1', 'e1', { status: 'going' } as never);
      expect(res).toEqual({ eventId: 'e1', status: 'going', attendeeCount: 5 });
      expect(runner.commitTransaction).toHaveBeenCalled();
    });

    it('404s on a missing event', async () => {
      const { runner } = makeQueryRunner([[]]); // SELECT FOR UPDATE -> none
      createQueryRunner.mockReturnValue(runner);
      await expect(
        service.rsvp('u1', 'missing', { status: 'going' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createPoll', () => {
    it('forbids a non-host', async () => {
      query.mockResolvedValueOnce([{ host_id: 'someone-else' }]); // assertHost lookup
      await expect(
        service.createPoll('u1', 'e1', { question: 'Q', options: ['a', 'b'] } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('vote', () => {
    it('rejects an option from a different poll', async () => {
      query
        .mockResolvedValueOnce([{ closed_at: null }]) // poll lookup
        .mockResolvedValueOnce([]); // option not found for this poll
      await expect(service.vote('u1', 'p1', 'bad-opt')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects voting on a closed poll', async () => {
      query.mockResolvedValueOnce([{ closed_at: new Date() }]);
      await expect(service.vote('u1', 'p1', 'o1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('upvoteQuestion', () => {
    it('increments only on a new (deduped) upvote', async () => {
      const { runner } = makeQueryRunner([
        [{ question_id: 'q1' }], // INSERT ... RETURNING (new row)
        [{ upvotes: 4 }], // UPDATE ... RETURNING upvotes
      ]);
      createQueryRunner.mockReturnValue(runner);
      const res = await service.upvoteQuestion('u1', 'q1');
      expect(res).toEqual({ id: 'q1', upvotes: 4 });
    });

    it('is idempotent when the user already upvoted', async () => {
      const { runner } = makeQueryRunner([
        [], // INSERT ON CONFLICT DO NOTHING -> no row
        [{ upvotes: 9 }], // SELECT current upvotes
      ]);
      createQueryRunner.mockReturnValue(runner);
      const res = await service.upvoteQuestion('u1', 'q1');
      expect(res).toEqual({ id: 'q1', upvotes: 9 });
    });
  });
});
