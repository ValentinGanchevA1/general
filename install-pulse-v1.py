#!/usr/bin/env python3
"""Install Pulse v1: Activity tab (renamed from Inbox) + ActionHub FAB.

Idempotent. Each edit asserts that its target context exists exactly once.
Re-running after success prints `!` warnings (already applied) and exits clean.

Usage:
  python install-pulse-v1.py [--dry-run]
"""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv


# ─── New / replacement files (always overwrite) ─────────────────────────────

FILES: dict[str, str] = {

    "packages/shared/src/activity.ts": r"""// packages/shared/src/activity.ts
//
// Activity-feed types shared between backend (aggregator) and mobile (Pulse + FAB).
// Surface-agnostic: same shape powers REST /feed, the Pulse list, future socket push.

export type ActivityType = 'chat' | 'wave' | 'listing' | 'alert' | 'match';

export type AreaCategory =
  | 'general'
  | 'food'
  | 'events'
  | 'help'
  | 'business'
  | 'news';

export interface ActivityItem {
  /** Composite key, stable for list dedupe: `${type}:${refId}`. */
  id: string;
  type: ActivityType;
  /** Only set on `alert` items (v1.5 — Nextdoor-style posts). */
  category: AreaCategory | null;

  title: string;
  preview: string;

  actorId: string | null;
  actorName: string | null;

  /** Server-computed from fuzzed locations. Null when source has no geo. */
  distanceM: number | null;

  /** ISO 8601, UTC. */
  createdAt: string;

  /** Drives bold + dot in the UI. Source-specific heuristic. */
  unread: boolean;

  /** What tapping the row does. Matches RootStackParamList screens. */
  deepLink: { screen: string; params?: Record<string, unknown> };
}

export interface FeedResponse {
  items: ActivityItem[];
  /** ISO timestamp to pass back as `since` for the next page (newest seen). */
  nextSince: string;
}

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'chat', 'wave', 'listing', 'alert', 'match',
] as const;

export const AREA_CATEGORIES: readonly AreaCategory[] = [
  'general', 'food', 'events', 'help', 'business', 'news',
] as const;
""",

    "apps/backend/src/modules/feed/feed.module.ts": r"""// apps/backend/src/modules/feed/feed.module.ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [AuthModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
""",

    "apps/backend/src/modules/feed/feed.controller.ts": r"""// apps/backend/src/modules/feed/feed.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import type { FeedResponse, ActivityType } from '@g88/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FeedService } from './feed.service';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query('since') since?: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
  ): Promise<FeedResponse> {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const typeList = (types ? types.split(',').filter(Boolean) : []) as ActivityType[];
    const cap = Math.min(Number(limit ?? 50) || 50, 100);
    return this.feed.aggregate(userId, sinceDate, typeList, cap);
  }
}
""",

    "apps/backend/src/modules/feed/feed.service.ts": r"""// apps/backend/src/modules/feed/feed.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { ActivityItem, ActivityType, FeedResponse } from '@g88/shared';

@Injectable()
export class FeedService {
  private readonly log = new Logger(FeedService.name);
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async aggregate(
    userId: string,
    since: Date,
    types: ActivityType[],
    limit: number,
  ): Promise<FeedResponse> {
    const t0 = Date.now();
    const wanted = (t: ActivityType): boolean => types.length === 0 || types.includes(t);

    const [chats, waves] = await Promise.all([
      wanted('chat') ? this.selectChats(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      wanted('wave') ? this.selectWaves(userId, since, limit) : Promise.resolve<ActivityItem[]>([]),
      // v1.5 sources slot in here: listings, alerts, matches
    ]);

    const items = [...chats, ...waves]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    this.log.log(
      `feed.aggregate userId=${userId} latencyMs=${Date.now() - t0} ` +
      `chats=${chats.length} waves=${waves.length} total=${items.length}`,
    );

    // Newest item's timestamp — clients pass it back as `since` to fetch what's even newer.
    return {
      items,
      nextSince: items[0]?.createdAt ?? new Date().toISOString(),
    };
  }

  /**
   * One row per conversation I belong to: the latest message, the other participant.
   * `unread` is a heuristic — we don't track read_at yet (P2/C6 outbox + read receipts).
   */
  private async selectChats(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query<Array<{
      id: string; conversation_id: string;
      actor_id: string; actor_name: string;
      preview: string; created_at: Date; unread: boolean;
    }>>(
      `SELECT ('chat:' || c.id)                                   AS id,
              c.id                                                  AS conversation_id,
              other.id                                              AS actor_id,
              other.display_name                                    AS actor_name,
              m.body                                                AS preview,
              m.created_at                                          AS created_at,
              (m.sender_id <> $1 AND m.created_at > NOW() - interval '24 hours') AS unread
         FROM conversations c
         JOIN LATERAL (
           SELECT id, sender_id, body, created_at
             FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
         ) m ON true
         JOIN LATERAL (
           SELECT u.id, u.display_name
             FROM users u
            WHERE u.id = ANY(c.participant_ids)
              AND u.id <> $1
              AND u.deleted_at IS NULL
            LIMIT 1
         ) other ON true
        WHERE $1 = ANY(c.participant_ids)
          AND m.created_at > $2
        ORDER BY m.created_at DESC
        LIMIT $3`,
      [userId, since.toISOString(), limit],
    );

    return rows.map((r): ActivityItem => ({
      id: r.id, type: 'chat', category: null,
      title: r.actor_name ?? 'Unknown', preview: r.preview,
      actorId: r.actor_id, actorName: r.actor_name, distanceM: null,
      createdAt: new Date(r.created_at).toISOString(),
      unread: r.unread,
      deepLink: { screen: 'Chat', params: { conversationId: r.conversation_id, otherUserName: r.actor_name ?? 'Chat' } },
    }));
  }

  /**
   * Waves received. `unread` proxy: not yet reciprocated (responded_at IS NULL).
   * If a reciprocal wave already opened a conversation, tap goes to that Chat.
   */
  private async selectWaves(userId: string, since: Date, limit: number): Promise<ActivityItem[]> {
    const rows = await this.ds.query<Array<{
      id: string; conversation_id: string | null;
      actor_id: string; actor_name: string;
      created_at: Date; unread: boolean;
    }>>(
      `SELECT ('wave:' || w.id)        AS id,
              w.conversation_id        AS conversation_id,
              w.from_user_id           AS actor_id,
              u.display_name           AS actor_name,
              w.created_at             AS created_at,
              (w.responded_at IS NULL) AS unread
         FROM waves w
         JOIN users u ON u.id = w.from_user_id AND u.deleted_at IS NULL
        WHERE w.to_user_id = $1
          AND w.created_at > $2
        ORDER BY w.created_at DESC
        LIMIT $3`,
      [userId, since.toISOString(), limit],
    );

    return rows.map((r): ActivityItem => ({
      id: r.id, type: 'wave', category: null,
      title: `${r.actor_name ?? 'Someone'} waved`,
      preview: r.conversation_id ? 'Conversation opened' : 'Wave back from the map',
      actorId: r.actor_id, actorName: r.actor_name, distanceM: null,
      createdAt: new Date(r.created_at).toISOString(),
      unread: r.unread,
      deepLink: r.conversation_id
        ? { screen: 'Chat', params: { conversationId: r.conversation_id, otherUserName: r.actor_name ?? 'Chat' } }
        : { screen: 'Main', params: { screen: 'Map' } },
    }));
  }
}
""",

    "apps/backend/src/modules/feed/feed.service.spec.ts": r"""// apps/backend/src/modules/feed/feed.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

import { FeedService } from './feed.service';

describe('FeedService', () => {
  let service: FeedService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const dsMock = { query } as unknown as DataSource;

    const mod = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: getDataSourceToken(), useValue: dsMock },
      ],
    }).compile();
    service = mod.get(FeedService);
  });

  it('merges chats + waves sorted newest first', async () => {
    query
      .mockResolvedValueOnce([
        {
          id: 'chat:c1', conversation_id: 'c1',
          actor_id: 'u1', actor_name: 'Alice',
          preview: 'hi',
          created_at: new Date('2026-05-22T10:00:00Z'),
          unread: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'wave:w1', conversation_id: null,
          actor_id: 'u2', actor_name: 'Bob',
          created_at: new Date('2026-05-22T11:00:00Z'),
          unread: true,
        },
      ]);

    const res = await service.aggregate('me', new Date('2026-05-15'), [], 50);

    expect(res.items).toHaveLength(2);
    expect(res.items[0]!.type).toBe('wave');
    expect(res.items[1]!.type).toBe('chat');
  });

  it('respects type filter (waves only)', async () => {
    query.mockResolvedValueOnce([]);
    await service.aggregate('me', new Date(), ['wave'], 50);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns valid nextSince when empty', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await service.aggregate('me', new Date(), [], 50);
    expect(res.items).toHaveLength(0);
    expect(Date.parse(res.nextSince)).not.toBeNaN();
  });
});
""",

    "apps/mobile/src/features/pulse/pulseSlice.ts": r"""// apps/mobile/src/features/pulse/pulseSlice.ts
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ActivityItem, ActivityType, FeedResponse } from '@g88/shared';

import { getJson } from '@/api/client';

export interface PulseState {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
}

const initialState: PulseState = {
  items: [],
  loading: false,
  error: null,
  lastFetchedAt: null,
};

export interface FetchFeedArgs {
  types?: ActivityType[];
  since?: string;
}

export const fetchFeed = createAsyncThunk<FeedResponse, FetchFeedArgs | undefined>(
  'pulse/fetch',
  async (args, { rejectWithValue }) => {
    try {
      const qs: string[] = [];
      if (args?.types?.length) qs.push(`types=${encodeURIComponent(args.types.join(','))}`);
      if (args?.since) qs.push(`since=${encodeURIComponent(args.since)}`);
      const suffix = qs.length ? `?${qs.join('&')}` : '';
      return await getJson<FeedResponse>(`/feed${suffix}`);
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load Pulse');
    }
  },
);

const slice = createSlice({
  name: 'pulse',
  initialState,
  reducers: {
    clearPulse: (s) => { s.items = []; s.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchFeed.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchFeed.fulfilled, (s, a: PayloadAction<FeedResponse>) => {
      s.loading = false; s.items = a.payload.items; s.lastFetchedAt = new Date().toISOString();
    });
    b.addCase(fetchFeed.rejected, (s, a) => {
      s.loading = false;
      s.error = (a.payload as string | undefined) ?? a.error.message ?? 'Failed';
    });
  },
});

export const { clearPulse } = slice.actions;
export default slice.reducer;
""",

    "apps/mobile/src/features/pulse/PulseScreen.tsx": r"""// apps/mobile/src/features/pulse/PulseScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {
  useNavigation, useFocusEffect, useRoute, type RouteProp,
} from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ActivityItem, ActivityType } from '@g88/shared';
import type { RootStackParamList, TabParamList, PulseFilter } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchFeed } from '@/features/pulse/pulseSlice';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<TabParamList, 'Pulse'>;

const FILTERS: { key: PulseFilter; label: string; type: ActivityType | null }[] = [
  { key: 'all',      label: 'All',     type: null },
  { key: 'chats',    label: 'Chats',   type: 'chat' },
  { key: 'waves',    label: 'Waves',   type: 'wave' },
  { key: 'listings', label: 'Trades',  type: 'listing' },
  { key: 'alerts',   label: 'Alerts',  type: 'alert' },
  { key: 'matches',  label: 'Matches', type: 'match' },
];

const ICON_BY_TYPE: Record<ActivityType, string> = {
  chat: 'message-text', wave: 'hand-wave', listing: 'tag', alert: 'bullhorn', match: 'heart',
};

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Row({ item, onPress }: { item: ActivityItem; onPress: () => void }): React.JSX.Element {
  const initials = (item.actorName ?? '?')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  return (
    <TouchableOpacity style={S.row} onPress={onPress}>
      <View style={[S.dot, { opacity: item.unread ? 1 : 0 }]} />
      <View style={S.avatar}><Text style={S.avatarText}>{initials}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={S.rowTop}>
          <Text style={[S.rowTitle, item.unread && S.rowTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={S.rowTime}>{relTime(item.createdAt)}</Text>
        </View>
        <Text style={S.rowPreview} numberOfLines={1}>{item.preview}</Text>
      </View>
      <MCI name={ICON_BY_TYPE[item.type]} size={18} color="#666" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

export function PulseScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { items, loading, error } = useAppSelector((s) => s.pulse);
  const [filter, setFilter] = useState<PulseFilter>(route.params?.filter ?? 'all');

  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  const load = useCallback(() => {
    const f = FILTERS.find((x) => x.key === filter);
    void dispatch(fetchFeed({ types: f?.type ? [f.type] : undefined }));
  }, [dispatch, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    return f?.type ? items.filter((i) => i.type === f.type) : items;
  }, [items, filter]);

  const onTap = (it: ActivityItem): void => {
    const { screen, params } = it.deepLink;
    if (screen === 'Main') {
      navigation.navigate('Main', params as never);
    } else {
      navigation.navigate(screen as keyof RootStackParamList, params as never);
    }
  };

  return (
    <View style={S.container}>
      <View style={S.header}><Text style={S.headerTitle}>Pulse</Text></View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={S.chips} contentContainerStyle={S.chipsContent}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[S.chip, active && S.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[S.chipText, active && S.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && items.length === 0 ? (
        <View style={S.center}><ActivityIndicator color="#00d4ff" /></View>
      ) : error ? (
        <View style={S.center}>
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={S.retry}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <MCI name="pulse" size={40} color="#2a2a4a" />
          <Text style={S.emptyTitle}>Quiet around here</Text>
          <Text style={S.emptyBody}>Pull to refresh, or tap + below.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <Row item={item} onPress={() => onTap(item)} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor="#00d4ff" />
          }
          contentContainerStyle={{ paddingBottom: 140 }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0a0f' },
  header:         { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle:    { color: '#fff', fontSize: 28, fontWeight: '700' },
  chips:          { maxHeight: 50 },
  chipsContent:   { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a' },
  chipActive:     { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText:       { color: '#aaa', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#0a0a0f', fontWeight: '700' },
  row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1a1a2e' },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00d4ff', marginRight: 8 },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText:     { color: '#00d4ff', fontWeight: '700' },
  rowTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle:       { color: '#aaa', fontSize: 15, flex: 1, marginRight: 8 },
  rowTitleUnread: { color: '#fff', fontWeight: '600' },
  rowTime:        { color: '#666', fontSize: 12 },
  rowPreview:     { color: '#666', fontSize: 13, marginTop: 2 },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText:      { color: '#ff6b6b', marginBottom: 12 },
  retry:          { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#1a1a2e', borderRadius: 20 },
  retryText:      { color: '#00d4ff', fontWeight: '600' },
  emptyTitle:     { color: '#aaa', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyBody:      { color: '#666', fontSize: 13, marginTop: 4 },
});
""",

    "apps/mobile/src/components/actionHubActions.ts": r"""// apps/mobile/src/components/actionHubActions.ts
import type { PulseFilter } from '@/navigation/AppNavigator';

export interface ActionHubAction {
  key: string;
  icon: string;
  label: string;
  filter: PulseFilter;
}

export const ACTION_HUB_ACTIONS: readonly ActionHubAction[] = [
  { key: 'chats',    icon: 'message-text', label: 'Chats',   filter: 'chats' },
  { key: 'waves',    icon: 'hand-wave',    label: 'Waves',   filter: 'waves' },
  { key: 'alerts',   icon: 'bullhorn',     label: 'Alerts',  filter: 'alerts' },
  { key: 'listings', icon: 'tag',          label: 'Trades',  filter: 'listings' },
  { key: 'matches',  icon: 'heart',        label: 'Matches', filter: 'matches' },
] as const;

export function findAction(key: string): ActionHubAction | undefined {
  return ACTION_HUB_ACTIONS.find((a) => a.key === key);
}
""",

    "apps/mobile/src/components/ActionHub.tsx": r"""// apps/mobile/src/components/ActionHub.tsx
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { ACTION_HUB_ACTIONS, type ActionHubAction } from './actionHubActions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ActionHub(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const nav = useNavigation<Nav>();

  const onAction = (a: ActionHubAction): void => {
    setOpen(false);
    nav.navigate('Main', { screen: 'Pulse', params: { filter: a.filter } });
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [S.fab, pressed && S.fabPressed]}
        onPress={() => setOpen(true)}
        testID="action-hub-fab"
        accessibilityRole="button"
        accessibilityLabel="Quick actions"
        hitSlop={8}
      >
        <MCI name="plus" size={28} color="#0a0a0f" />
      </Pressable>

      <Modal
        visible={open} transparent animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={S.backdrop}
          onPress={() => setOpen(false)}
          testID="action-hub-backdrop"
        >
          <View style={S.sheet} onStartShouldSetResponder={() => true}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Quick actions</Text>
            {ACTION_HUB_ACTIONS.map((a) => (
              <Pressable
                key={a.key}
                style={({ pressed }) => [S.action, pressed && S.actionPressed]}
                testID={`action-${a.key}`}
                onPress={() => onAction(a)}
              >
                <View style={S.actionIcon}>
                  <MCI name={a.icon} size={22} color="#00d4ff" />
                </View>
                <Text style={S.actionLabel}>{a.label}</Text>
                <MCI name="chevron-right" size={20} color="#555" style={{ marginLeft: 'auto' }} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00d4ff', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8, zIndex: 100,
  },
  fabPressed:    { opacity: 0.85, transform: [{ scale: 0.95 }] },
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2a2a4a', alignSelf: 'center', marginBottom: 12 },
  sheetTitle:    { color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  action:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12 },
  actionPressed: { backgroundColor: '#0a0a0f' },
  actionIcon:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionLabel:   { color: '#fff', fontSize: 16, fontWeight: '500' },
});
""",

    "apps/mobile/src/components/__tests__/actionHubActions.spec.ts": r"""// apps/mobile/src/components/__tests__/actionHubActions.spec.ts
import { ACTION_HUB_ACTIONS, findAction } from '../actionHubActions';

describe('ActionHub action map', () => {
  it('exposes all five activity types in the expected order', () => {
    expect(ACTION_HUB_ACTIONS.map((a) => a.filter)).toEqual([
      'chats', 'waves', 'alerts', 'listings', 'matches',
    ]);
  });

  it('each action declares an icon and a label', () => {
    for (const a of ACTION_HUB_ACTIONS) {
      expect(a.icon.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
    }
  });

  it('keys are unique', () => {
    const keys = ACTION_HUB_ACTIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('findAction resolves known keys', () => {
    expect(findAction('chats')?.filter).toBe('chats');
    expect(findAction('matches')?.filter).toBe('matches');
  });

  it('findAction returns undefined for unknown keys', () => {
    expect(findAction('nope')).toBeUndefined();
  });
});
""",

}


# ─── Surgical edits (idempotent — each pattern must match exactly once) ─────

EDITS: list[dict] = [

    # packages/shared/src/index.ts: export the new module
    {
        "path": "packages/shared/src/index.ts",
        "changes": [(
            "export * from './events';",
            "export * from './events';\nexport * from './activity';",
        )],
    },

    # apps/backend/src/app.module.ts: import FeedModule + register it
    {
        "path": "apps/backend/src/app.module.ts",
        "changes": [
            (
                "import { NotificationsModule } from './modules/notifications/notifications.module';\nimport { RealtimeModule } from './realtime/realtime.module';",
                "import { NotificationsModule } from './modules/notifications/notifications.module';\nimport { FeedModule } from './modules/feed/feed.module';\nimport { RealtimeModule } from './realtime/realtime.module';",
            ),
            (
                "    NotificationsModule,\n    RealtimeModule,",
                "    NotificationsModule,\n    FeedModule,\n    RealtimeModule,",
            ),
        ],
    },

    # apps/mobile/src/store/index.ts: register pulse reducer
    {
        "path": "apps/mobile/src/store/index.ts",
        "changes": [
            (
                "import chatReducer from '@/features/chat/chatSlice';\n\nexport const store",
                "import chatReducer from '@/features/chat/chatSlice';\nimport pulseReducer from '@/features/pulse/pulseSlice';\n\nexport const store",
            ),
            (
                "    chat: chatReducer,\n  },",
                "    chat: chatReducer,\n    pulse: pulseReducer,\n  },",
            ),
        ],
    },

    # apps/mobile/src/navigation/AppNavigator.tsx: 4 surgical edits
    {
        "path": "apps/mobile/src/navigation/AppNavigator.tsx",
        "changes": [
            # Edit 1: add NavigatorScreenParams to import
            (
                "import { NavigationContainer } from '@react-navigation/native';",
                "import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';",
            ),
            # Edit 2: swap InboxScreen import for PulseScreen + ActionHub
            (
                "import { InboxScreen } from '@/screens/InboxScreen';\nimport { ProfileScreen } from '@/screens/ProfileScreen';\nimport { ProfileCreationScreen } from '@/screens/ProfileCreationScreen';\nimport { ProfileEditScreen } from '@/screens/ProfileEditScreen';\nimport { ChatScreen } from '@/screens/ChatScreen';\nimport { SettingsScreen } from '@/screens/SettingsScreen';",
                "import { PulseScreen } from '@/features/pulse/PulseScreen';\nimport { ProfileScreen } from '@/screens/ProfileScreen';\nimport { ProfileCreationScreen } from '@/screens/ProfileCreationScreen';\nimport { ProfileEditScreen } from '@/screens/ProfileEditScreen';\nimport { ChatScreen } from '@/screens/ChatScreen';\nimport { SettingsScreen } from '@/screens/SettingsScreen';\nimport { ActionHub } from '@/components/ActionHub';",
            ),
            # Edit 3: rewrite RootStackParamList + TabParamList (introduces PulseFilter)
            (
                "export type RootStackParamList = {\n  Auth: undefined;\n  ProfileCreation: undefined;\n  Main: undefined;\n  Chat: { conversationId: string; otherUserName: string };\n  ProfileEdit: undefined;\n  Settings: undefined;\n};\n\nexport type TabParamList = {\n  Map: undefined;\n  Inbox: undefined;\n  Profile: undefined;\n};",
                "export type PulseFilter =\n  | 'all'\n  | 'chats'\n  | 'waves'\n  | 'listings'\n  | 'alerts'\n  | 'matches';\n\nexport type TabParamList = {\n  Map: undefined;\n  Pulse: { filter?: PulseFilter } | undefined;\n  Profile: undefined;\n};\n\nexport type RootStackParamList = {\n  Auth: undefined;\n  ProfileCreation: undefined;\n  Main: NavigatorScreenParams<TabParamList> | undefined;\n  Chat: { conversationId: string; otherUserName: string };\n  ProfileEdit: undefined;\n  Settings: undefined;\n};",
            ),
            # Edit 4: rewrite MainTabs to wrap Tab.Navigator in View + mount ActionHub + rename Inbox→Pulse
            (
                "function MainTabs(): React.JSX.Element {\n  return (\n    <Tab.Navigator\n      screenOptions={({ route }) => ({\n        headerShown: false,\n        tabBarStyle: { backgroundColor: '#0a0a0f', borderTopColor: '#1a1a2e' },\n        tabBarActiveTintColor: '#00d4ff',\n        tabBarInactiveTintColor: '#555',\n        tabBarIcon: ({ color, size }) => {\n          const icons: Record<string, string> = {\n            Map: 'map-marker-radius',\n            Inbox: 'message-outline',\n            Profile: 'account-circle-outline',\n          };\n          return <MaterialCommunityIcons name={icons[route.name] ?? 'circle'} size={size} color={color} />;\n        },\n      })}\n    >\n      <Tab.Screen name=\"Map\" component={MapScreen} />\n      <Tab.Screen name=\"Inbox\" component={InboxScreen} />\n      <Tab.Screen name=\"Profile\" component={ProfileScreen} />\n    </Tab.Navigator>\n  );\n}",
                "function MainTabs(): React.JSX.Element {\n  return (\n    <View style={{ flex: 1 }}>\n      <Tab.Navigator\n        screenOptions={({ route }) => ({\n          headerShown: false,\n          tabBarStyle: { backgroundColor: '#0a0a0f', borderTopColor: '#1a1a2e', height: 64, paddingTop: 6 },\n          tabBarActiveTintColor: '#00d4ff',\n          tabBarInactiveTintColor: '#555',\n          tabBarIcon: ({ color, size }) => {\n            const icons: Record<string, string> = {\n              Map: 'map-marker-radius',\n              Pulse: 'pulse',\n              Profile: 'account-circle-outline',\n            };\n            return <MaterialCommunityIcons name={icons[route.name] ?? 'circle'} size={size} color={color} />;\n          },\n        })}\n      >\n        <Tab.Screen name=\"Map\" component={MapScreen} />\n        <Tab.Screen name=\"Pulse\" component={PulseScreen} />\n        <Tab.Screen name=\"Profile\" component={ProfileScreen} />\n      </Tab.Navigator>\n      <ActionHub />\n    </View>\n  );\n}",
            ),
        ],
    },

]


# ─── Runner ─────────────────────────────────────────────────────────────────

def main() -> int:
    if not (ROOT / "apps/backend/src/app.module.ts").exists():
        print("ERROR: must be run from the g88 monorepo root", file=sys.stderr)
        return 1

    banner = "DRY RUN — no changes written" if DRY else "Installing Pulse v1"
    print(f"{banner}  (root={ROOT})\n")

    print("Files:")
    for rel, content in FILES.items():
        dest = ROOT / rel
        verb = "overwrite" if dest.exists() else "create"
        if DRY:
            print(f"  [{verb:9}] {rel}  ({len(content):>5} bytes)")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8", newline="\n")
        sigil = "~" if verb == "overwrite" else "+"
        print(f"  {sigil} {rel}")

    print("\nEdits:")
    warnings = 0
    for spec in EDITS:
        p: Path = ROOT / spec["path"]
        if not p.exists():
            print(f"  ! {spec['path']}: file missing")
            warnings += 1
            continue
        text = p.read_text(encoding="utf-8")
        new_text = text
        applied = 0
        for i, (find, replace) in enumerate(spec["changes"], start=1):
            count = new_text.count(find)
            if count == 0:
                print(f"  ! {spec['path']} change#{i}: pattern not found (already applied?)")
                warnings += 1
                continue
            if count > 1:
                print(f"  ! {spec['path']} change#{i}: matched {count} times — refusing to edit")
                warnings += 1
                continue
            new_text = new_text.replace(find, replace, 1)
            applied += 1
        if applied and not DRY:
            p.write_text(new_text, encoding="utf-8", newline="\n")
        verb = "[edit]" if DRY else "~"
        print(f"  {verb} {spec['path']}  ({applied}/{len(spec['changes'])} changes)")

    print(f"\nDone. {warnings} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
