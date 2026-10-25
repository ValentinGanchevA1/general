import * as Sentry from '@sentry/react-native';

import { recordNexaLaunchPerformance } from './sentry';

describe('recordNexaLaunchPerformance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the actual launch UX path as sampled span attributes', () => {
    const end = jest.fn();
    const startInactiveSpan = jest
      .spyOn(Sentry, 'startInactiveSpan')
      .mockReturnValue({ end } as never);

    recordNexaLaunchPerformance({
      startedAtMs: 1_000,
      completedAtMs: 2_650,
      path: 'map',
      totalMs: 1_650,
      authReadyMs: 180,
      mapReadyMs: 520,
      overlayHiddenMs: 1_080,
      mapReadyFailOpen: false,
      spatialHandoffUsed: true,
      reducedMotion: false,
    });

    expect(startInactiveSpan).toHaveBeenCalledWith({
      name: 'NEXA branded launch',
      op: 'ui.load',
      startTime: 1,
      attributes: {
        'nexa.launch.path': 'map',
        'nexa.launch.total_ms': 1_650,
        'nexa.launch.map_ready_fail_open': false,
        'nexa.launch.spatial_handoff_used': true,
        'nexa.launch.auth_ready_ms': 180,
        'nexa.launch.map_ready_ms': 520,
        'nexa.launch.overlay_hidden_ms': 1_080,
        'nexa.launch.reduced_motion': false,
      },
    });
    expect(end).toHaveBeenCalledWith(2.65);
  });

  it('omits nullable phase attributes when they were not observed', () => {
    const end = jest.fn();
    const startInactiveSpan = jest
      .spyOn(Sentry, 'startInactiveSpan')
      .mockReturnValue({ end } as never);

    recordNexaLaunchPerformance({
      startedAtMs: 5_000,
      completedAtMs: 5_800,
      path: 'non_map',
      totalMs: 800,
      authReadyMs: null,
      mapReadyMs: null,
      overlayHiddenMs: null,
      mapReadyFailOpen: false,
      spatialHandoffUsed: false,
      reducedMotion: null,
    });

    expect(startInactiveSpan).toHaveBeenCalledWith({
      name: 'NEXA branded launch',
      op: 'ui.load',
      startTime: 5,
      attributes: {
        'nexa.launch.path': 'non_map',
        'nexa.launch.total_ms': 800,
        'nexa.launch.map_ready_fail_open': false,
        'nexa.launch.spatial_handoff_used': false,
      },
    });
    expect(end).toHaveBeenCalledWith(5.8);
  });
});
