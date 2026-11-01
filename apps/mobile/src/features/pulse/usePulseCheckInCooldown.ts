import { useEffect, useState } from 'react';

import { useAppSelector } from '@/hooks/redux';
import { isCheckInCooldownActive } from './pulseSlice';

export interface PulseCheckInCooldownStatus {
  active: boolean;
  checkedInHere: boolean;
  cooldownUntilMs: number | null;
}

/**
 * Session-only UX guard for the server-authoritative global check-in cooldown.
 * Schedules a single re-render at expiry so disabled actions recover without
 * polling and without persisting any location or check-in payload locally.
 */
export function usePulseCheckInCooldown(placeId: string | null): PulseCheckInCooldownStatus {
  const cooldownUntilMs = useAppSelector((state) => state.pulse.checkInCooldownUntilMs);
  const lastCheckInPlaceId = useAppSelector((state) => state.pulse.lastCheckInPlaceId);
  const [, setExpiryTick] = useState(0);
  const active = isCheckInCooldownActive(cooldownUntilMs);

  useEffect(() => {
    if (!active || cooldownUntilMs == null) return undefined;
    const delayMs = Math.max(0, cooldownUntilMs - Date.now() + 50);
    const timeout = setTimeout(() => setExpiryTick((value) => value + 1), delayMs);
    return () => clearTimeout(timeout);
  }, [active, cooldownUntilMs]);

  return {
    active,
    checkedInHere: active && placeId != null && lastCheckInPlaceId === placeId,
    cooldownUntilMs,
  };
}
