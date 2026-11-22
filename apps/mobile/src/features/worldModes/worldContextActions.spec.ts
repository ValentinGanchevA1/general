import { resolveWorldContextActions } from './worldContextActions';

describe('World contextual actions (W2-4)', () => {
  it('provides contextual affordances', () => {
    expect(resolveWorldContextActions('pathfinder').map((action) => action.id)).toContain('save-place');
    expect(resolveWorldContextActions('bazaar').map((action) => action.id)).toContain('view-listing');
    expect(resolveWorldContextActions('architect').map((action) => action.id)).toContain('create-event');
  });
  it('returns no suggestions for presentation-only Worlds', () => {
    expect(resolveWorldContextActions('nexus')).toEqual([]);
    expect(resolveWorldContextActions('noir')).toEqual([]);
    expect(resolveWorldContextActions('profiler')).toEqual([]);
  });
  it('uses a finite action vocabulary', () => {
    const allowed = new Set(['view-event', 'save-place', 'view-listing', 'create-event', 'join-community', 'view-challenge', 'view-invitation']);
    for (const id of ['pathfinder', 'nocturne', 'bazaar', 'architect', 'diplomat', 'vanguard', 'sanctuary'] as const) {
      for (const action of resolveWorldContextActions(id)) expect(allowed.has(action.id)).toBe(true);
    }
  });
});
