import { Injectable } from '@nestjs/common';
import type {
  DiscoveryEntityLeaveEvent,
  DiscoveryEntityUpsertEvent,
} from '@g88/shared';

import { RealtimeGateway } from './realtime.gateway';

/**
 * Emits discovery deltas only to a specific viewer's authenticated room.
 *
 * Callers must pass an EntityPoint that has already gone through the same
 * visibility, block, mode, and location-privacy rules as /discovery/nearby.
 * This service deliberately has no cell-wide broadcast API: a discovery
 * entity that is safe for one viewer may be hidden from another viewer in the
 * same cell.
 */
@Injectable()
export class DiscoveryRealtimePublisher {
  constructor(private readonly realtime: RealtimeGateway) {}

  emitEnter(viewerId: string, event: DiscoveryEntityUpsertEvent): void {
    this.realtime.server
      .to(this.viewerRoom(viewerId))
      .emit('discovery:entity:enter', event);
  }

  emitUpdate(viewerId: string, event: DiscoveryEntityUpsertEvent): void {
    this.realtime.server
      .to(this.viewerRoom(viewerId))
      .emit('discovery:entity:update', event);
  }

  emitLeave(viewerId: string, event: DiscoveryEntityLeaveEvent): void {
    this.realtime.server
      .to(this.viewerRoom(viewerId))
      .emit('discovery:entity:leave', event);
  }

  private viewerRoom(viewerId: string): string {
    return `user:${viewerId}`;
  }
}
