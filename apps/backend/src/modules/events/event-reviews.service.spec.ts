import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SaveEventReviewDto, ReviewPageDto } from './review.dto';
import { EventReviewsService } from './event-reviews.service';

const dto = { rating: 4, tags: [], comment: '' } satisfies SaveEventReviewDto;
const gate = { host_id: 'host', started: true, ended: true, going: true, confirmed: true };
function setup(results: unknown[]) {
  const query = jest.fn().mockImplementation(() => Promise.resolve(results.shift() ?? []));
  const tx = { query } as unknown as EntityManager;
  const db = { transaction: jest.fn((first: string | ((m: EntityManager) => Promise<unknown>), cb?: (m: EntityManager) => Promise<unknown>) => (typeof first === 'string' ? cb! : first)(tx)) } as unknown as DataSource;
  return { service: new EventReviewsService(db), query };
}
describe('Event review authorization and timing', () => {
  it.each([
    { ...gate, ended: false }, { ...gate, going: false }, { ...gate, confirmed: false }, { ...gate, host_id: 'actor' },
  ])('rejects ineligible create and edit: %j', async state => {
    for (const edit of [false, true]) {
      const { service, query } = setup([[state], [state]]);
      await expect(service.save('actor', 'event', dto, edit)).rejects.toBeInstanceOf(ForbiddenException);
      expect(query).toHaveBeenCalledTimes(2);
    }
  });
  it('does not query reviews for an inaccessible event', async () => {
    const { service, query } = setup([[]]);
    await expect(service.me('actor', 'event')).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('maps concurrent duplicate create to conflict', async () => {
    const { service } = setup([[gate], [gate], []]);
    await expect(service.save('actor', 'event', dto, false)).rejects.toBeInstanceOf(ConflictException);
  });
  it('maps unavailable/exact-deadline edits to a conflict', async () => {
    const { service, query } = setup([[gate], [gate], []]);
    await expect(service.save('actor', 'event', dto, true)).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls[2]![0]).toContain('editable_until > clock_timestamp()');
  });
  it('reads timing only after acquiring the event lock', async () => {
    const { service, query } = setup([[gate], [gate], []]);
    await expect(service.save('actor', 'event', dto, false)).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls[0]![0]).toContain('FOR UPDATE OF e');
    expect(query.mock.calls[1]![0]).toContain('clock_timestamp()');
  });
  it.each([{ ...gate, started: false, ended: false }, { ...gate, ended: true }])('cannot confirm outside the event', async state => {
    const { service } = setup([[state], [state]]);
    await expect(service.confirm('host', 'event', 'actor')).rejects.toBeInstanceOf(ConflictException);
  });
  it('cannot confirm oneself or act as another host', async () => {
    const state = { ...gate, ended: false };
    const first = setup([[state], [state]]);
    await expect(first.service.confirm('host', 'event', 'host')).rejects.toBeInstanceOf(ConflictException);
    const second = setup([[state], [state]]);
    await expect(second.service.confirm('actor', 'event', 'other')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('cannot end a future event', async () => {
    const state = { ...gate, started: false, ended: false };
    const { service } = setup([[state], [state]]);
    await expect(service.end('host', 'event')).rejects.toBeInstanceOf(ConflictException);
  });
});
describe('Review DTO validation', () => {
  it.each([
    { rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: '5' },
    { tags: ['spam'] }, { tags: ['welcoming', 'welcoming'] },
    { tags: ['welcoming', 'great_venue', 'good_value', 'well_organized'] },
    { comment: 'x'.repeat(501) }, { comment: null }, { tags: null },
  ])('rejects invalid input %j', async bad => {
    expect((await validate(plainToInstance(SaveEventReviewDto, { ...dto, ...bad }))).length).toBeGreaterThan(0);
  });
  it('accepts 500 Unicode code points and trims comments', async () => {
    const value = plainToInstance(SaveEventReviewDto, { ...dto, comment: `  ${'😀'.repeat(500)}  ` });
    expect(await validate(value)).toEqual([]);
    expect(Array.from(value.comment)).toHaveLength(500);
  });
  it('accepts a stars-only request without optional context', async () => {
    const value = plainToInstance(SaveEventReviewDto, { rating: 5 });
    expect(await validate(value)).toEqual([]);
    expect(value.tags).toEqual([]); expect(value.comment).toBe('');
  });
  it('bounds pagination and validates cursors', async () => {
    expect((await validate(plainToInstance(ReviewPageDto, { limit: 51, cursor: 'bad' }))).length).toBe(2);
  });
});
