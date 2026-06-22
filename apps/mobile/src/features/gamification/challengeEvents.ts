// apps/mobile/src/features/gamification/challengeEvents.ts
//
// Tiny in-process event bus so challenge-affecting actions (sending a wave,
// posting an alert) can signal the long-lived map banner to re-read progress.
// Mirrors the AuthEvents pattern in api/client.ts. The DailyChallengeCard lives
// inside the never-unmounting MapScreen, so without this nudge its progress
// freezes at map-mount time even though the backend has advanced it.

type ChallengeEvent = 'progress';

class ChallengeEvents {
  private listeners = new Map<ChallengeEvent, Set<() => void>>();

  emit(e: ChallengeEvent): void {
    this.listeners.get(e)?.forEach((fn) => fn());
  }

  on(e: ChallengeEvent, fn: () => void): () => void {
    if (!this.listeners.has(e)) this.listeners.set(e, new Set());
    this.listeners.get(e)!.add(fn);
    return () => this.listeners.get(e)!.delete(fn);
  }
}

export const challengeEvents = new ChallengeEvents();
