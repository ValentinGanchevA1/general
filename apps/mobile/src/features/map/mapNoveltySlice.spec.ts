import reducer, {
  clearMapNewCount,
  clearPlaceMapNewCount,
  setMapNewCount,
  setPlaceMapNewCount,
} from './mapNoveltySlice';

describe('mapNoveltySlice', () => {
  it('aggregates legacy and public Place novelty counts', () => {
    let state = reducer(undefined, setMapNewCount(3));
    state = reducer(state, setPlaceMapNewCount(2));

    expect(state).toEqual({
      newCount: 5,
      legacyNewCount: 3,
      placeNewCount: 2,
    });
  });

  it('caps the aggregate badge at 99', () => {
    let state = reducer(undefined, setMapNewCount(80));
    state = reducer(state, setPlaceMapNewCount(40));

    expect(state.newCount).toBe(99);
  });

  it('clears only Place novelty without losing legacy count', () => {
    let state = reducer(undefined, setMapNewCount(4));
    state = reducer(state, setPlaceMapNewCount(2));
    state = reducer(state, clearPlaceMapNewCount());

    expect(state).toEqual({
      newCount: 4,
      legacyNewCount: 4,
      placeNewCount: 0,
    });
  });

  it('clears the whole map badge when Map becomes active', () => {
    let state = reducer(undefined, setMapNewCount(4));
    state = reducer(state, setPlaceMapNewCount(2));
    state = reducer(state, clearMapNewCount());

    expect(state).toEqual({
      newCount: 0,
      legacyNewCount: 0,
      placeNewCount: 0,
    });
  });
});
