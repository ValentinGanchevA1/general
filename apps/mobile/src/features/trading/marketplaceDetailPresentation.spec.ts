import {
  marketplaceKindLabel,
  marketplacePricePrefix,
} from './marketplaceDetailPresentation';

describe('marketplace detail presentation', () => {
  it('labels first-class Marketplace kinds without changing transaction semantics', () => {
    expect(marketplaceKindLabel('for_sale')).toBe('For Sale');
    expect(marketplaceKindLabel('service')).toBe('Service');
    expect(marketplaceKindLabel('job')).toBe('Job');
    expect(marketplaceKindLabel('local_deal')).toBe('Local Deal');
  });

  it('keeps wanted/legacy detail outside the Marketplace taxonomy', () => {
    expect(marketplaceKindLabel(null)).toBeNull();
  });

  it('uses the existing browse convention for service pricing only', () => {
    expect(marketplacePricePrefix('service')).toBe('From ');
    expect(marketplacePricePrefix('for_sale')).toBe('');
    expect(marketplacePricePrefix('job')).toBe('');
    expect(marketplacePricePrefix('local_deal')).toBe('');
    expect(marketplacePricePrefix(null)).toBe('');
  });
});
