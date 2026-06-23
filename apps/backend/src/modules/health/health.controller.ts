import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Unauthenticated liveness probe. Returns 200 with no DB/Redis work, so it's
 * cheap to hit frequently — used by the external keep-warm pinger (cron-job.org)
 * to stop Render's free tier from spinning g88-api down, and as a general health
 * check. Public (no JwtAuthGuard) and throttle-exempt so the pinger never trips
 * the global rate limit.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  check(): { status: 'ok'; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}