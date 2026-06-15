// apps/mobile/src/features/events/eventMerge.ts
//
// Pure reducers that fold live P3.5 socket deltas (event:poll / event:question /
// event:question:upvote) into the locally-held poll & Q&A lists. The deltas are
// viewer-agnostic by design (no myVote / upvotedByMe — those are broadcast to a
// whole room), so each helper preserves the current client's own per-viewer
// state and only overlays the shared counts.

import type {
  EventPollDelta,
  EventQuestion,
  EventQuestionDelta,
  EventQuestionUpvoteDelta,
  PollResult,
} from '@g88/shared';

/** Apply a poll create/vote delta — append a new poll, or update an existing
 *  poll's shared fields while keeping this client's `myVote`. */
export function mergePoll(prev: PollResult[], delta: EventPollDelta): PollResult[] {
  const idx = prev.findIndex((p) => p.id === delta.id);
  if (idx === -1) {
    // New poll the host just created — this client hasn't voted yet.
    return [...prev, { ...delta, myVote: null }];
  }
  // `delta` is Omit<PollResult,'myVote'>, so spreading it preserves this client's
  // own `myVote` while overlaying every shared field.
  return prev.map((p) => (p.id === delta.id ? { ...p, ...delta } : p));
}

/** Apply a new-question delta — insert (with upvotedByMe=false) or update shared
 *  fields, then keep the server's "top questions first" ordering. */
export function mergeQuestion(prev: EventQuestion[], delta: EventQuestionDelta): EventQuestion[] {
  const exists = prev.some((q) => q.id === delta.id);
  // `delta` is Omit<EventQuestion,'upvotedByMe'>, so spreading it preserves this
  // client's own `upvotedByMe` while overlaying every shared field.
  const next = exists
    ? prev.map((q) => (q.id === delta.id ? { ...q, ...delta } : q))
    : [...prev, { ...delta, upvotedByMe: false }];
  return sortQuestions(next);
}

/** Apply an upvote-count delta — overlay the new count, preserve `upvotedByMe`. */
export function applyQuestionUpvote(
  prev: EventQuestion[],
  delta: EventQuestionUpvoteDelta,
): EventQuestion[] {
  return sortQuestions(
    prev.map((q) => (q.id === delta.questionId ? { ...q, upvotes: delta.upvotes } : q)),
  );
}

/** Server ordering: most-upvoted first, oldest-first as the tiebreak. */
function sortQuestions(qs: EventQuestion[]): EventQuestion[] {
  return [...qs].sort((a, b) => b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt));
}
