import { track } from '@/lib/analytics';

/**
 * Track long-press create intent without persisting precise user coordinates in
 * the generic analytics pipeline. The coordinate remains local to the create
 * flow and is only used to seed the requested entity location.
 */
export function trackMapLongPressCreate(): void {
  track('map.longpress_create');
}
