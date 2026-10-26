import {resolveMapInteractionState} from './mapInteractionState';

describe('resolveMapInteractionState', () => {
  it('returns idle when no interaction surface is active', () => {
    expect(
      resolveMapInteractionState({
        previewRequested: false,
        isDetail: false,
        isFull: false,
      }),
    ).toBe('idle');
  });

  it('maps preview to quick_peek', () => {
    expect(
      resolveMapInteractionState({
        previewRequested: true,
        isDetail: false,
        isFull: false,
      }),
    ).toBe('quick_peek');
  });

  it('maps detail states to detail even if preview is transiently true', () => {
    expect(
      resolveMapInteractionState({
        previewRequested: true,
        isDetail: true,
        isFull: false,
      }),
    ).toBe('detail');
  });

  it('gives full profile highest precedence', () => {
    expect(
      resolveMapInteractionState({
        previewRequested: true,
        isDetail: true,
        isFull: true,
      }),
    ).toBe('full_profile');
  });
});
