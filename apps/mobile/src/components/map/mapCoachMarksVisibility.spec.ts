import { shouldPresentMapCoachMarks } from './mapCoachMarksVisibility';

describe('shouldPresentMapCoachMarks', () => {
  it('shows only after first-session state and map readiness are resolved', () => {
    expect(shouldPresentMapCoachMarks({
      shouldShow: true,
      mapReady: true,
      contextualSelectionVisible: false,
    })).toBe(true);

    expect(shouldPresentMapCoachMarks({
      shouldShow: null,
      mapReady: true,
      contextualSelectionVisible: false,
    })).toBe(false);

    expect(shouldPresentMapCoachMarks({
      shouldShow: true,
      mapReady: false,
      contextualSelectionVisible: false,
    })).toBe(false);
  });

  it('defers while a selected entity or place owns the map interaction surface', () => {
    expect(shouldPresentMapCoachMarks({
      shouldShow: true,
      mapReady: true,
      contextualSelectionVisible: true,
    })).toBe(false);
  });
});
