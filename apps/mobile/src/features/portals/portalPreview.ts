import type { EventMeta } from '@g88/shared';

/**
 * Dev-only rollout. Portal previews must not change the initial Play release.
 * Launch requires a reviewed runtime flag and device QA in a later PR.
 */
export const PORTAL_EVENT_PREVIEW_ENABLED = __DEV__;

export type PortalPreviewStatus =
  | 'upcoming'
  | 'started'
  | 'at-capacity'
  | 'schedule-unavailable';

export interface PortalPreviewViewModel {
  status: PortalPreviewStatus;
  statusLabel: string;
  goingLabel: string;
  capacityLabel: string | null;
}

/**
 * Discovery only exposes startsAt, not an end timestamp or cancellation state.
 * We must never infer that the event is LIVE or that attendance is confirmed.
 */
export function resolvePortalPreview(
  meta: Pick<EventMeta, 'startsAt' | 'attendeeCount' | 'capacity'>,
  nowMs: number,
): PortalPreviewViewModel {
  const count = Number.isFinite(meta.attendeeCount)
    ? Math.max(0, meta.attendeeCount)
    : 0;
  const capacity = meta.capacity != null &&
    Number.isFinite(meta.capacity) &&
    meta.capacity > 0
    ? meta.capacity
    : null;
  const start = Date.parse(meta.startsAt);

  const status: PortalPreviewStatus =
    capacity != null && count >= capacity
      ? 'at-capacity'
      : !Number.isFinite(start)
        ? 'schedule-unavailable'
        : start <= nowMs
          ? 'started'
          : 'upcoming';

  return {
    status,
    statusLabel: {
      upcoming: 'Upcoming',
      started: 'Started · check event details',
      'at-capacity': 'At capacity · check availability',
      'schedule-unavailable': 'Schedule unavailable',
    }[status],
    goingLabel: `${count} going`,
    capacityLabel: capacity == null ? null : `${capacity} capacity`,
  };
}
