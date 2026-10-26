import { Injectable, OnModuleInit } from '@nestjs/common';
import type {
  DiscoveryEntityLeaveEvent,
  DiscoveryEntityUpsertEvent,
  DiscoveryPointKey,
  EntityKind,
  LatLng,
} from '@g88/shared';

import { DiscoveryEntityResolver } from '../modules/discovery/discovery-entity-resolver.service';
import {
  DiscoveryMutationBusService,
  type DiscoveryMutation,
} from './discovery-mutation-bus.service';
import { RealtimeEmitterService } from './realtime-emitter.service';
import {
  type ActiveDiscoverySubscription,
  DiscoverySubscriptionStore,
} from './discovery-subscription.store';

type DiscoverableKind = EntityKind;
type DiscoveryRealtimeChange = 'enter' | 'update';

/**
 * Emits discovery deltas only to sockets with an active matching discovery
 * subscription. Mutations are distributed through Redis so each backend
 * instance performs viewer-safe fanout against its own local subscriptions.
 */
@Injectable()
export class DiscoveryRealtimePublisher implements OnModuleInit {
  constructor(
    private readonly realtime: RealtimeEmitterService,
    private readonly resolver: DiscoveryEntityResolver,
    private readonly subscriptions: DiscoverySubscriptionStore,
    private readonly mutationBus: DiscoveryMutationBusService,
  ) {}

  onModuleInit(): void {
    this.mutationBus.setHandler((mutation) => this.consumeMutation(mutation));
  }

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

  async publishEntityChangeToSubscribers(params: {
    kind: DiscoverableKind;
    entityId: string;
    location: LatLng;
    change: DiscoveryRealtimeChange;
  }): Promise<number> {
    await this.mutationBus.publish({ type: 'change', ...params });
    return 0;
  }

  async publishEntityMovement(params: {
    kind: DiscoverableKind;
    entityId: string;
    previousLocation: LatLng;
    location: LatLng;
  }): Promise<number> {
    await this.mutationBus.publish({ type: 'movement', ...params });
    return 0;
  }

  emitEnter(viewerId: string, event: DiscoveryEntityUpsertEvent): void {
    this.realtime.to(this.viewerRoom(viewerId)).emit('discovery:entity:enter', event);
  }

  emitUpdate(viewerId: string, event: DiscoveryEntityUpsertEvent): void {
    this.realtime.to(this.viewerRoom(viewerId)).emit('discovery:entity:update', event);
  }

  emitLeave(viewerId: string, event: DiscoveryEntityLeaveEvent): void {
    this.realtime.to(this.viewerRoom(viewerId)).emit('discovery:entity:leave', event);
  }

  private async consumeMutation(mutation: DiscoveryMutation): Promise<void> {
    if (mutation.type === 'movement') {
      await this.publishMovementLocally(mutation);
      return;
    }

    const candidates = this.subscriptions.candidatesForEntity(mutation.kind, mutation.location);
    await this.publishToCandidates(mutation, candidates);
  }

  private async publishMovementLocally(params: {
    kind: DiscoverableKind;
    entityId: string;
    previousLocation: LatLng;
    location: LatLng;
  }): Promise<void> {
    const previousCandidates = this.subscriptions.candidatesForEntity(
      params.kind,
      params.previousLocation,
    );
    const currentCandidates = this.subscriptions.candidatesForEntity(params.kind, params.location);
    const currentSocketIds = new Set(currentCandidates.map((candidate) => candidate.socketId));
    const leaveEvent: DiscoveryEntityLeaveEvent = {
      key: `${params.kind}:${params.entityId}` as DiscoveryPointKey,
    };

    for (const candidate of previousCandidates) {
      if (!currentSocketIds.has(candidate.socketId)) {
        this.emitLeaveToSocket(candidate.socketId, leaveEvent);
      }
    }

    await this.publishToCandidates(
      { ...params, change: 'update' },
      currentCandidates,
    );
  }

  private async publishToCandidates(
    params: {
      kind: DiscoverableKind;
      entityId: string;
      change: DiscoveryRealtimeChange;
    },
    candidates: readonly ActiveDiscoverySubscription[],
  ): Promise<number> {
    let published = 0;

    for (const candidate of candidates) {
      const point = await this.resolver.resolveForViewer({
        viewerId: candidate.viewerId,
        kind: params.kind,
        entityId: params.entityId,
        context: candidate.query,
      });

      if (point == null || point.kind === 'cluster') {
        this.emitLeaveToSocket(candidate.socketId, {
          key: `${params.kind}:${params.entityId}` as DiscoveryPointKey,
        });
        continue;
      }

      const event: DiscoveryEntityUpsertEvent = { point };
      if (params.change === 'enter') {
        this.emitEnterToSocket(candidate.socketId, event);
      } else {
        this.emitUpdateToSocket(candidate.socketId, event);
      }
      published += 1;
    }

    return published;
  }

  private emitEnterToSocket(socketId: string, event: DiscoveryEntityUpsertEvent): void {
    this.realtime.to(socketId).emit('discovery:entity:enter', event);
  }

  private emitUpdateToSocket(socketId: string, event: DiscoveryEntityUpsertEvent): void {
    this.realtime.to(socketId).emit('discovery:entity:update', event);
  }

  private emitLeaveToSocket(socketId: string, event: DiscoveryEntityLeaveEvent): void {
    this.realtime.to(socketId).emit('discovery:entity:leave', event);
  }

  private viewerRoom(viewerId: string): string {
    return `user:${viewerId}`;
  }
}
