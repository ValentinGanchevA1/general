import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import * as h3 from 'h3-js';

import { fuzzLocation, type LatLng } from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';

/**
 * Presence model
 * ──────────────
 * Online state is ephemeral and lives ONLY in Redis. Postgres has no idea who's
 * online "right now" — that's the whole point. Two key spaces:
 *
 *   presence:user:{userId}                  → string "1", TTL 120s
 *     Existence = online. Refreshed on each heartbeat.
 *
 *   presence:cell:{h3r8}                    → ZSET, member = userId,
 *                                              score = last-heartbeat epoch ms
 *     For per-cell scans (presence delta fan-out, "who's nearby right now").
 *
 * On reconnect or geo change, the service migrates the userId between cell
 * ZSETs and emits a `presence:delta` event via the realtime gateway.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private static readonly TTL_SECONDS = 120;
  /**
   * H3 r8 cells are ~0.7 km² — a good unit for "nearby" presence fan-out.
   * Coarser than the discovery storage resolution, intentionally:
   * presence updates from a single neighborhood share a room.
   */
  private static readonly PRESENCE_RES = 8;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Record a heartbeat: mark user online and add to their current cell's set.
   * Returns the cell id so the gateway can join the matching socket room.
   *
   * Location is fuzzed to r10 centroid before any storage or fan-out.
   */
  async heartbeat(userId: string, location: LatLng): Promise<{ cellId: string }> {
    const fuzzed = fuzzLocation(location, 10);
    const cellId = h3.latLngToCell(fuzzed.lat, fuzzed.lng, PresenceService.PRESENCE_RES);
    const now = Date.now();

    // Read previous cell so we can move the user if they crossed a cell boundary.
    const prevCellKey = `presence:user_cell:${userId}`;
    const prevCellId = await this.redis.get(prevCellKey);

    const pipe = this.redis.pipeline();
    pipe.set(`presence:user:${userId}`, '1', 'EX', PresenceService.TTL_SECONDS);
    pipe.set(prevCellKey, cellId, 'EX', PresenceService.TTL_SECONDS);
    pipe.zadd(`presence:cell:${cellId}`, now, userId);
    pipe.expire(`presence:cell:${cellId}`, PresenceService.TTL_SECONDS);

    if (prevCellId && prevCellId !== cellId) {
      pipe.zrem(`presence:cell:${prevCellId}`, userId);
    }

    await pipe.exec();
    return { cellId };
  }

  /** Mark a user offline immediately (called on socket disconnect). */
  async markOffline(userId: string): Promise<void> {
    const cellKey = `presence:user_cell:${userId}`;
    const cellId = await this.redis.get(cellKey);
    const pipe = this.redis.pipeline();
    pipe.del(`presence:user:${userId}`);
    pipe.del(cellKey);
    if (cellId) pipe.zrem(`presence:cell:${cellId}`, userId);
    await pipe.exec();
  }

  /** Given a candidate list, return only those currently online. */
  async whichAreOnline(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const keys = userIds.map((id) => `presence:user:${id}`);
    const values = await this.redis.mget(keys);
    const online = new Set<string>();
    values.forEach((v, i) => {
      if (v === '1') {
        const id = userIds[i];
        if (id !== undefined) online.add(id);
      }
    });
    return online;
  }

  /** Garbage-collect expired entries from a cell ZSET. Cheap; runs opportunistically. */
  async pruneCell(cellId: string): Promise<void> {
    const cutoff = Date.now() - PresenceService.TTL_SECONDS * 1000;
    await this.redis.zremrangebyscore(`presence:cell:${cellId}`, '-inf', cutoff);
  }

  /** Users currently in a presence cell, sorted by most recent heartbeat. */
  async usersInCell(cellId: string, limit = 50): Promise<string[]> {
    return this.redis.zrevrange(`presence:cell:${cellId}`, 0, limit - 1);
  }
}
