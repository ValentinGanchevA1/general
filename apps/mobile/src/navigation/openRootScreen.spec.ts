import { openRootScreen } from './openRootScreen';

describe('openRootScreen — NEXA re-entry', () => {
  it('routes legacy Interactions destinations to Main -> Connections', () => {
    const navigate = jest.fn();

    openRootScreen(
      { navigate: navigate as (...args: never[]) => void },
      'Interactions',
    );

    expect(navigate).toHaveBeenCalledWith('Main', { screen: 'Connections' });
  });

  it('keeps nested destinations unchanged', () => {
    const navigate = jest.fn();

    openRootScreen(
      { navigate: navigate as (...args: never[]) => void },
      'Marketplace',
    );

    expect(navigate).toHaveBeenCalledWith('Commerce', { screen: 'Marketplace' });
  });
});
