import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { PaidTier, SubscriptionTier } from '@g88/shared';

type StripeNS = typeof import('stripe');
type StripeClient = import('stripe').Stripe;

let stripe: StripeClient | null = null;

async function getStripe(): Promise<StripeClient | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripe) {
    const Stripe = ((await import('stripe')) as unknown as { default: StripeNS['Stripe'] }).default;
    stripe = new Stripe(key);
  }
  return stripe;
}

// Tier → env var holding its Stripe price id. Reverse-mapped on webhook.
const PRICE_ENV: Record<PaidTier, string> = {
  basic: 'STRIPE_PRICE_BASIC',
  premium: 'STRIPE_PRICE_PREMIUM',
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** Create (or reuse) a hosted Checkout session for a paid tier. */
  async createCheckout(userId: string, tier: PaidTier): Promise<string> {
    const client = await this.requireStripe();
    const price = process.env[PRICE_ENV[tier]];
    if (!price) {
      throw new InternalServerErrorException({
        code: 'subscription.misconfigured',
        message: `No Stripe price configured for ${tier}`,
      });
    }
    const customer = await this.ensureCustomer(userId, client);

    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price, quantity: 1 }],
      success_url: process.env.STRIPE_SUCCESS_URL ?? 'https://g88.app/billing/success',
      cancel_url: process.env.STRIPE_CANCEL_URL ?? 'https://g88.app/billing/cancel',
      metadata: { userId, tier },
    });
    if (!session.url) {
      throw new InternalServerErrorException({
        code: 'subscription.checkout_failed',
        message: 'Stripe did not return a checkout URL',
      });
    }
    return session.url;
  }

  /** Billing-portal session so the user can manage or cancel. */
  async createPortal(userId: string): Promise<string> {
    const client = await this.requireStripe();
    const customerId = await this.getCustomerId(userId);
    if (!customerId) {
      throw new BadRequestException({
        code: 'subscription.no_customer',
        message: 'No active subscription to manage',
      });
    }
    const session = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL ?? 'https://g88.app/billing',
    });
    return session.url;
  }

  /** Verify the Stripe signature and reconcile tier from the event. */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const client = await getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!client || !secret) {
      throw new ServiceUnavailableException({
        code: 'subscription.unavailable',
        message: 'Stripe webhooks are not configured',
      });
    }

    let event: import('stripe').Stripe.Event;
    try {
      event = client.webhooks.constructEvent(rawBody, signature, secret);
    } catch (e) {
      this.logger.warn(`[stripe] bad webhook signature: ${(e as Error).message}`);
      throw new BadRequestException({ code: 'subscription.bad_signature', message: 'Invalid signature' });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription && typeof session.subscription === 'string') {
          const sub = await client.subscriptions.retrieve(session.subscription);
          await this.applySubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await this.applySubscription(event.data.object);
        break;
      }
      default:
        break;
    }
  }

  private async applySubscription(sub: import('stripe').Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const active = sub.status === 'active' || sub.status === 'trialing';
    const priceId = sub.items.data[0]?.price.id;
    const tier: SubscriptionTier = active ? this.tierForPrice(priceId) : 'free';
    const subscriptionId = tier === 'free' ? null : sub.id;

    const result = await this.db.query(
      `UPDATE users
          SET subscription_tier = $2, stripe_subscription_id = $3, updated_at = NOW()
        WHERE stripe_customer_id = $1 AND deleted_at IS NULL`,
      [customerId, tier, subscriptionId],
    );
    this.logger.log(`[stripe] customer=${customerId} → tier=${tier} status=${sub.status}`);
    void result;
  }

  private tierForPrice(priceId: string | undefined): SubscriptionTier {
    if (!priceId) return 'free';
    for (const tier of Object.keys(PRICE_ENV) as PaidTier[]) {
      if (process.env[PRICE_ENV[tier]] === priceId) return tier;
    }
    return 'free';
  }

  private async getCustomerId(userId: string): Promise<string | null> {
    const rows = await this.db.query<Array<{ stripe_customer_id: string | null }>>(
      `SELECT stripe_customer_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    return rows[0]?.stripe_customer_id ?? null;
  }

  private async ensureCustomer(userId: string, client: StripeClient): Promise<string> {
    const existing = await this.getCustomerId(userId);
    if (existing) return existing;

    const rows = await this.db.query<Array<{ email: string; display_name: string }>>(
      `SELECT email, display_name FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!rows[0]) {
      throw new BadRequestException({ code: 'users.not_found', message: 'User not found' });
    }

    const customer = await client.customers.create({
      email: rows[0].email,
      name: rows[0].display_name,
      metadata: { userId },
    });
    await this.db.query(`UPDATE users SET stripe_customer_id = $2 WHERE id = $1`, [userId, customer.id]);
    return customer.id;
  }

  private async requireStripe(): Promise<StripeClient> {
    const client = await getStripe();
    if (!client) {
      throw new ServiceUnavailableException({
        code: 'subscription.unavailable',
        message: 'Subscriptions are not available right now',
      });
    }
    return client;
  }
}
