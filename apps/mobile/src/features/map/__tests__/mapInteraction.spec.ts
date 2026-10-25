import {
  initialMapInteractionState,
  reduceMapInteraction,
  selectedMapPointKey,
} from '../contracts/mapInteraction';

describe('map interaction state machine', () => {
  const userKey = 'user:user-1' as const;
  const eventKey = 'event:event-1' as const;

  it('selects exactly one discovery point', () => {
    const selected = reduceMapInteraction(initialMapInteractionState, {
      type: 'SELECT',
      key: userKey,
    });

    expect(selected).toEqual({ type: 'selected', key: userKey });
    expect(selectedMapPointKey(selected)).toBe(userKey);
  });

  it('replaces selection instead of allowing two active points', () => {
    const first = reduceMapInteraction(initialMapInteractionState, {
      type: 'SELECT',
      key: userKey,
    });
    const second = reduceMapInteraction(first, {
      type: 'SELECT',
      key: eventKey,
    });

    expect(second).toEqual({ type: 'selected', key: eventKey });
  });

  it('preserves spatial selection through peek and detail', () => {
    const peek = reduceMapInteraction(initialMapInteractionState, {
      type: 'OPEN_PEEK',
      key: eventKey,
    });
    const detail = reduceMapInteraction(peek, {
      type: 'OPEN_DETAIL',
      key: eventKey,
    });

    expect(selectedMapPointKey(peek)).toBe(eventKey);
    expect(selectedMapPointKey(detail)).toBe(eventKey);
    expect(reduceMapInteraction(detail, { type: 'BACK' })).toEqual(peek);
    expect(reduceMapInteraction(peek, { type: 'BACK' })).toEqual({
      type: 'selected',
      key: eventKey,
    });
  });

  it('makes create mode mutually exclusive with selection', () => {
    const selected = reduceMapInteraction(initialMapInteractionState, {
      type: 'SELECT',
      key: userKey,
    });
    const creating = reduceMapInteraction(selected, {
      type: 'START_CREATE',
      coordinate: { latitude: 43.2141, longitude: 27.9147 },
    });

    expect(creating).toEqual({
      type: 'creating',
      coordinate: { latitude: 43.2141, longitude: 27.9147 },
    });
    expect(selectedMapPointKey(creating)).toBeNull();
  });

  it('closes every interaction surface back to idle', () => {
    const detail = reduceMapInteraction(initialMapInteractionState, {
      type: 'OPEN_DETAIL',
      key: userKey,
    });

    expect(reduceMapInteraction(detail, { type: 'CLOSE' })).toEqual(
      initialMapInteractionState,
    );
  });
});
