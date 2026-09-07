import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@g88/shared';
import { colors } from '@/theme';

interface Props {
  msg: ChatMessage;
  isMine: boolean;
}

export function LocationSessionBubble({ msg, isMine }: Props): React.JSX.Element {
  return (
    <View style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapTheirs]}>
      <View style={[styles.card, isMine ? styles.cardMine : styles.cardTheirs]}>
        <Text style={styles.icon}>📍</Text>
        <View style={styles.copy}>
          <Text style={[styles.title, isMine && styles.titleMine]}>Live location</Text>
          <Text style={[styles.body, isMine && styles.bodyMine]} numberOfLines={3}>
            {msg.body || (isMine ? 'You started sharing' : 'Started sharing')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '85%', marginVertical: 4 },
  wrapMine: { alignSelf: 'flex-end' },
  wrapTheirs: { alignSelf: 'flex-start' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  cardMine: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardTheirs: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong,
  },
  icon: { fontSize: 22 },
  copy: { flexShrink: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  titleMine: { color: colors.onPrimary },
  body: { color: colors.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },
  bodyMine: { color: 'rgba(10,10,15,0.67)' },
});
