import type { RootStackParamList } from '@/navigation/AppNavigator';

describe('map top controls contract', () => {
  it('keeps focusMyPin addressable through the canonical Map tab', () => {
    const target: Exclude<RootStackParamList['Main'], undefined> = {
      screen: 'Map',
      params: { focusMyPin: true },
    };

    expect(target).toEqual({ screen: 'Map', params: { focusMyPin: true } });
  });
});
