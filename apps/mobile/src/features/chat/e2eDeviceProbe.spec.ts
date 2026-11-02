jest.mock('@/config', () => ({
  Config: { E2E_DEVICE_PROBE: true },
}));

import { emitE2EDeviceProbe } from './e2eDeviceProbe';

describe('emitE2EDeviceProbe', () => {
  it('emits only the fixed event marker', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    emitE2EDeviceProbe('location_update');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[NEXA_E2E_DEVICE] location_update');
    log.mockRestore();
  });
});
