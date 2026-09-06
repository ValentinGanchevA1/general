import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { LocationShareSession } from '@g88/shared';
import { colors } from '@/theme';

interface Props {
  session: LocationShareSession;
  isSharer: boolean;
  peerName?: string;
  onStop: () => void;
  onOpenMap: () => void;
}

function formatRemaining(endsAt: string | null, nowMs: number): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - nowMs;
  if (ms <= 0) return 'ending…';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')} left`;
}

export function LocationSessionBanner({
  session,
  isSharer,
  peerName,
  onStop,
  onOpenMap,
}: Props): React.JSX.Element {
  // Tick clock drives re-renders; remaining is derived (no setState of label in effect).
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!session.endsAt) return;
    const t = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [session.endsAt, session.id]);

  const remaining = formatRemaining(session.endsAt, nowMs);

  const title = isSharer
    ? 'You are sharing live location'
    : `${peerName || 'They'} is sharing live location`;

  const timeLabel = remaining ?? (session.duration === 'until_off' ? 'until stopped' : null);

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <Text style={styles.pin}>📍</Text>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {timeLabel ? (
            <Text style={styles.time} numberOfLines={1}>
              {timeLabel}
            </Text>
          ) : null}
        </View>
      </View>
      {isSharer ? (
        <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.85}>
          <Text style={styles.stopText}>Stop</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap} activeOpacity={0.85}>
          <Text style={styles.mapText}>Open map</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pin: { fontSize: 16 },
  copy: { flex: 1 },
  title: { color: colors.info, fontSize: 13, fontWeight: '600' },
  time: { color: colors.primary, fontSize: 12, marginTop: 1 },
  stopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.danger + '22',
    borderWidth: 1,
    borderColor: colors.danger + '55',
  },
  stopText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  mapBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  mapText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
