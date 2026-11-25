import { resolveMapChromePrototypeEnabled } from '../mapChromePrototype';

describe('map chrome visual prototype flag', () => {
  it('fails closed unless the exact opt-in value is 1', () => {
    expect(resolveMapChromePrototypeEnabled(undefined)).toBe(false);
    expect(resolveMapChromePrototypeEnabled('')).toBe(false);
    expect(resolveMapChromePrototypeEnabled('0')).toBe(false);
    expect(resolveMapChromePrototypeEnabled('true')).toBe(false);
    expect(resolveMapChromePrototypeEnabled('TRUE')).toBe(false);
    expect(resolveMapChromePrototypeEnabled(' 1')).toBe(false);
    expect(resolveMapChromePrototypeEnabled('1 ')).toBe(false);
    expect(resolveMapChromePrototypeEnabled('1')).toBe(true);
  });
});
