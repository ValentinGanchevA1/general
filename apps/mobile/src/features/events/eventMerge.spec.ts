import type {
  EventPollDelta,
  EventQuestion,
  EventQuestionDelta,
  PollResult,
} from '@g88/shared';

import { applyQuestionUpvote, mergePoll, mergeQuestion } from './eventMerge';

const poll = (over: Partial<PollResult> = {}): PollResult => ({
  id: 'p1',
  eventId: 'e1',
  question: 'Q?',
  options: [
    { id: 'o1', label: 'a', votes: 0 },
    { id: 'o2', label: 'b', votes: 0 },
  ],
  totalVotes: 0,
  closedAt: null,
  myVote: null,
  ...over,
});

const pollDelta = (over: Partial<EventPollDelta> = {}): EventPollDelta => ({
  id: 'p1',
  eventId: 'e1',
  question: 'Q?',
  options: [
    { id: 'o1', label: 'a', votes: 1 },
    { id: 'o2', label: 'b', votes: 0 },
  ],
  totalVotes: 1,
  closedAt: null,
  ...over,
});

const question = (over: Partial<EventQuestion> = {}): EventQuestion => ({
  id: 'q1',
  eventId: 'e1',
  userId: 'u1',
  displayName: 'Alex',
  body: 'Hi?',
  upvotes: 0,
  answered: false,
  upvotedByMe: false,
  createdAt: '2026-06-15T10:00:00.000Z',
  ...over,
});

const questionDelta = (over: Partial<EventQuestionDelta> = {}): EventQuestionDelta => ({
  id: 'q2',
  eventId: 'e1',
  userId: 'u2',
  displayName: 'Sam',
  body: 'New?',
  upvotes: 0,
  answered: false,
  createdAt: '2026-06-15T10:05:00.000Z',
  ...over,
});

describe('mergePoll', () => {
  it('appends a brand-new poll with myVote=null', () => {
    const res = mergePoll([], pollDelta());
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ id: 'p1', totalVotes: 1, myVote: null });
  });

  it('updates shared tally but preserves this client myVote', () => {
    const res = mergePoll([poll({ myVote: 'o2' })], pollDelta({ totalVotes: 5 }));
    expect(res[0]?.totalVotes).toBe(5);
    expect(res[0]?.myVote).toBe('o2'); // not clobbered by the broadcast
    expect(res[0]?.options[0]?.votes).toBe(1);
  });

  it('leaves unrelated polls untouched', () => {
    const other = poll({ id: 'p9', myVote: 'o1' });
    const res = mergePoll([other], pollDelta());
    expect(res).toHaveLength(2);
    expect(res.find((p) => p.id === 'p9')).toEqual(other);
  });
});

describe('mergeQuestion', () => {
  it('inserts a new question with upvotedByMe=false', () => {
    const res = mergeQuestion([question()], questionDelta());
    expect(res).toHaveLength(2);
    expect(res.find((q) => q.id === 'q2')).toMatchObject({ upvotedByMe: false });
  });

  it('keeps upvotedByMe when a known question is re-broadcast', () => {
    const res = mergeQuestion(
      [question({ upvotedByMe: true, upvotes: 3 })],
      questionDelta({ id: 'q1', upvotes: 4, body: 'edited' }),
    );
    expect(res[0]).toMatchObject({ upvotes: 4, body: 'edited', upvotedByMe: true });
  });

  it('sorts most-upvoted first, oldest as tiebreak', () => {
    const res = mergeQuestion(
      [question({ id: 'q1', upvotes: 2 })],
      questionDelta({ id: 'q2', upvotes: 5 }),
    );
    expect(res.map((q) => q.id)).toEqual(['q2', 'q1']);
  });
});

describe('applyQuestionUpvote', () => {
  it('overlays the count, preserves upvotedByMe, and re-sorts', () => {
    const list = [question({ id: 'q1', upvotes: 1 }), question({ id: 'q2', upvotes: 0, upvotedByMe: true })];
    const res = applyQuestionUpvote(list, { eventId: 'e1', questionId: 'q2', upvotes: 9 });
    expect(res.map((q) => q.id)).toEqual(['q2', 'q1']);
    expect(res[0]).toMatchObject({ upvotes: 9, upvotedByMe: true });
  });

  it('is a no-op for an unknown question id', () => {
    const list = [question({ id: 'q1', upvotes: 1 })];
    const res = applyQuestionUpvote(list, { eventId: 'e1', questionId: 'zzz', upvotes: 9 });
    expect(res).toEqual(list);
  });
});
