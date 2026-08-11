import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { LocationShareSession } from '@g88/shared';

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
  is Sharer b,
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
    backgroundColor: '#0d1f2a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a3a4a',
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pin: { fontSize: 16 },
  copy: { flex: 1 },
  title: { color: '#e6f7ff', fontSize: 13, fontWeight: '600' },
  time: { color: '#7ec8e3', fontSize: 12, marginTop: 1 },
  stopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ff3b5c22',
    borderWidth: 1,
    borderColor: '#ff3b5c55',
  },
  stopText: { color: '#ff6b8a', fontSize: 13, fontWeight: '700' },
  mapBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#00d4ff22',
    borderWidth: 1,
    borderColor: '#00d4ff55',
  },
  mapText: { color: '#00d4ff', fontSize: 13, fontWeight: '700' },
});
