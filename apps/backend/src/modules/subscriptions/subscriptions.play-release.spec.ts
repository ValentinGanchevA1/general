import { ServiceUnavailableException } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';

describe('first Google Play release billing gate', () => {
  const previous = process.env.ENABLE_PAID_SUBSCRIPTIONS;
  afterEach(() => {
    if (previous === undefined) delete process.env.ENABLE_PAID_SUBSCRIPTIONS;
    else process.env.ENABLE_PAID_SUBSCRIPTIONS = previous;
  });

  it('does not create a checkout session by default', async () => {
    delete process.env.ENABLE_PAID_SUBSCRIPTIONS;
    const createCheckout = jest.fn();
    const controller = new SubscriptionsController({ createCheckout } as never);
    await expect(controller.checkout('test-user', { tier: 'premium' }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('requires explicit enabled config for future non-Play deployments', async () => {
    process.env.ENABLE_PAID_SUBSCRIPTIONS = 'true';
    const createCheckout = jest.fn().mockResolvedValue('https://example.test/checkout');
    const controller = new SubscriptionsController({ createCheckout } as never);
    await expect(controller.checkout('test-user', { tier: 'premium' }))
      .resolves.toEqual({ url: 'https://example.test/checkout' });
  });
});
