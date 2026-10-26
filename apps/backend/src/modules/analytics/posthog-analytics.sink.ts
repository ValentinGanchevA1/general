import { Injectable, Logger } from '@nestjs/common';

import type {
  ProductAnalyticsEventName,
  ProductAnalyticsProperties,
} from '@g88/shared';

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
const CAPTURE_TIMEOUT_MS = 2_500;

function enabled(): boolean {
  return process.env.POSTHOG_ENABLED?.trim().toLowerCase() === 'true';
}

function projectToken(): string | null {
  const token = process.env.POSTHOG_PROJECT_TOKEN?.trim();
  return token ? token : null;
}

function captureUrl(): string {
  const host = process.env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
  return `${host.replace(/\/$/, '')}/i/v0/e/`;
}

@Injectable()
export class PostHogAnalyticsSink {
  private readonly logger = new Logger(PostHogAnalyticsSink.name);
  private warnedMissingToken = false;

  async capture(
    subjectHash: string,
    event: ProductAnalyticsEventName,
    properties: ProductAnalyticsProperties,
  ): Promise<void> {
    if (!enabled()) return;

    const apiKey = projectToken();
    if (!apiKey) {
      if (!this.warnedMissingToken) {
        this.warnedMissingToken = true;
        this.logger.warn(
          'PostHog analytics is enabled but POSTHOG_PROJECT_TOKEN is missing; mirror delivery is disabled.',
        );
      }
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS);

    try {
      const response = await fetch(captureUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          distinct_id: subjectHash,
          event,
          properties: {
            ...properties,
            // NEXA intentionally keeps PostHog as a pseudonymous event mirror,
            // not a second person-profile / identity database.
            $process_person_profile: false,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `PostHog analytics mirror rejected an event with HTTP ${response.status}.`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown delivery error';
      this.logger.warn(`PostHog analytics mirror delivery failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
