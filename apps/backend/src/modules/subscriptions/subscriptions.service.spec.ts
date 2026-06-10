// apps/backend/src/modules/subscriptions/subscriptions.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

// Single mock Stripe client shared across the module-level singleton in the service.
const mockStripe = {
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
  subscriptions: { retrieve: jest.fn() },
  customers: { create: jest.fn() },
};
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => mockStripe),
}));

import { SubscriptionsService } from './subscriptions.service';

// Minimal Stripe.Subscription shape the service actually reads.
interface FakeSub {
  id: string;
  status: string;
  customer: string;
  items: { data: Array<{ price: { id: string | undefined } }> };
}
function makeSub(over: {
  status: string;
  priceId?: string;
  customer?: string;
  id?: string;
}): FakeSub {
  return {
    id: over.id ?? 'sub_123',
    status: over.status,
    customer: over.customer ?? 'cus_1',
    items: { data: [{ price: { id: over.priceId } }] },
  };
}

const ORIGINAL_ENV = process.env;

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let query: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      STRIPE_PRICE_BASIC: 'price_basic',
      STRIPE_PRICE_PREMIUM: 'price_premium',
    };

    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
      ],
    }).compile();
    service = mod.get(SubscriptionsService);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('handleWebhook — signature gate (tier is set only by a verified event)', () => {
    it('rejects a forged/invalid signature and writes nothing', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('no signatures found matching the expected signature');
      });

      await expect(service.handleWebhook(Buffer.from('{}'), 'bad-sig')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(query).not.toHaveBeenCalled();
    });

    it('is unavailable when the webhook secret is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(mockStripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('is unavailable when Stripe is not configured (no secret key)', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('handleWebhook — tier reconciliation', () => {
    it('upgrades the customer to the tier matching the active price', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: makeSub({ status: 'active', priceId: 'price_premium', customer: 'cus_42' }) },
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0]!;
      expect(sql).toContain('UPDATE users');
      expect(sql).toContain('subscription_tier');
      expect(params).toEqual(['cus_42', 'premium', 'sub_123']);
    });

    it('treats a trialing subscription as active', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: makeSub({ status: 'trialing', priceId: 'price_basic' }) },
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(query.mock.calls[0]![1]).toEqual(['cus_1', 'basic', 'sub_123']);
    });

    it('downgrades to free (and clears the subscription id) on deletion/cancellation', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: makeSub({ status: 'canceled', priceId: 'price_premium' }) },
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(query.mock.calls[0]![1]).toEqual(['cus_1', 'free', null]);
    });

    it('grants no tier when the active price is not one we recognize', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: makeSub({ status: 'active', priceId: 'price_unknown' }) },
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(query.mock.calls[0]![1]).toEqual(['cus_1', 'free', null]);
    });

    it('resolves the subscription before applying on checkout.session.completed', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_777' } },
      });
      mockStripe.subscriptions.retrieve.mockResolvedValue(
        makeSub({ status: 'active', priceId: 'price_basic', customer: 'cus_9', id: 'sub_777' }),
      );

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_777');
      expect(query.mock.calls[0]![1]).toEqual(['cus_9', 'basic', 'sub_777']);
    });

    it('ignores unhandled event types without touching the database', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: { object: {} },
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('createCheckout', () => {
    it('creates a customer when none exists and returns the session url with tier metadata', async () => {
      query
        .mockResolvedValueOnce([{ stripe_customer_id: null }]) // getCustomerId
        .mockResolvedValueOnce([{ email: 'a@b.co', display_name: 'Ann' }]) // ensureCustomer lookup
        .mockResolvedValueOnce([]); // persist stripe_customer_id
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.test/s' });

      const url = await service.createCheckout('u1', 'premium');

      expect(url).toBe('https://checkout.test/s');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.co', metadata: { userId: 'u1' } }),
      );
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          customer: 'cus_new',
          metadata: { userId: 'u1', tier: 'premium' },
          line_items: [{ price: 'price_premium', quantity: 1 }],
        }),
      );
    });

    it('throws misconfigured when the tier has no Stripe price configured', async () => {
      delete process.env.STRIPE_PRICE_PREMIUM;
      await expect(service.createCheckout('u1', 'premium')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('is unavailable when Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      await expect(service.createCheckout('u1', 'basic')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('createPortal', () => {
    it('returns the billing-portal url for a customer', async () => {
      query.mockResolvedValueOnce([{ stripe_customer_id: 'cus_1' }]);
      mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://portal.test' });

      await expect(service.createPortal('u1')).resolves.toBe('https://portal.test');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_1' }),
      );
    });

    it('rejects when the user has no Stripe customer', async () => {
      query.mockResolvedValueOnce([{ stripe_customer_id: null }]);
      await expect(service.createPortal('u1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
