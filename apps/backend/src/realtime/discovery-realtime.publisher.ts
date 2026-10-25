import { Injectable } from '@nestjs/common';
import type {
  DiscoveryEntityLeaveEvent,
  DiscoveryEntityUpsertEvent,
  EntityKind,
} from '@g88/shared';

import { DiscoveryEntityResolver } from '../modules/discovery/discovery-entity-resolver.service';
import { RealtimeGateway } from './realtime.gateway';

type DiscoverableKind = Exclude<EntityKind, 'cluster'>;
type DiscoveryRealtimeChange = 'enter' | 'update';

/**
 * Emits discovery deltas only to a specific viewer's authenticated room.
 *
 * Raw entity changes must use publishEntityChange(), which resolves the entity
 * through the viewer-specific discovery privacy boundary before emission.
 */
@Injectable()
export class DiscoveryRealtimePublisher {
  constructor(
    private readonly realtime: RealtimeGateway,
    private readonly resolver: DiscoveryEntityResolver,
  ) {}

  async publishEntityChange(params: {
    viewerId: string;
    kind: DiscoverableKind;
    entityId: string;
    change: DiscoveryRealtimeChange;
  }): Promise<boolean> {
    const point = await this.resolver.resolveForViewer({
      viewerId: params.viewerId,
      kind: params.kind,
      entityId: params.entityId,
    });
    if (point == null || point.kind === 'cluster') return false;

    const event: DiscoveryEntityUpsertEvent = { point };
    if (params.change === 'enter') {
      this.emitEnter(params.viewerId, event);
    } else {
      this.emitUpdate(params.viewerId, event);
    }
    return true;
  }

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
