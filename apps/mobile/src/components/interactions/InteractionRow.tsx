import React, { memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { Interaction, ChatInteraction } from '@shared/types/interaction';

interface Props {
  item: Interaction;
  onPress: () => void;
  onMatchPress: () => void;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export const InteractionRow = memo(function InteractionRow({
  item,
  onPress,
  onMatchPress,
}: Props) {
  const isChat = item.type === 'chat';
  const chat = isChat ? (item as ChatInteraction) : null;
  const unread = isChat ? (chat!.unreadCount > 0) : !item.isRead;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatarWrap}>
        {item.user.avatarUrl ? (
          <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>
              {item.user.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {item.user.isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
            {item.user.displayName}
          </Text>
          {item.user.isVerified && <Text style={styles.verified}>✓</Text>}
        </View>

        {isChat && chat ? (
          <Text style={[styles.preview, unread && styles.bold]} numberOfLines={1}>
            {chat.lastMessage.isFromMe ? 'You: ' : ''}
            {chat.lastMessage.text}
          </Text>
        ) : (
          <Text style={styles.preview}>
            {item.type === 'wave' && 'waved at you'}
            {item.type === 'follow' && 'started following you'}
            {item.type === 'match' && "It's a match!"}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        <Text style={styles.time}>{formatRelative(item.lastActivityAt)}</Text>

        {isChat && chat && chat.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Text>
          </View>
        )}

        {item.type === 'wave' && (
          <TouchableOpacity style={styles.matchBtn} onPress={onMatchPress}>
            <Text style={styles.matchText}>Match</Text>
          </TouchableOpacity>
        )}

        {item.type === 'follow' && (
          <View style={styles.followingBtn}>
            <Text style={styles.followingText}>
              {(item as any).isFollowingBack ? 'Following' : 'Follow back'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C22',
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    backgroundColor: '#2A2A32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 18, fontWeight: '600' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C853',
    borderWidth: 2,
    borderColor: '#0B0B0F',
  },
  content: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: '#fff', fontSize: 16, fontWeight: '500' },
  verified: { color: '#1DA1F2', fontSize: 14 },
  preview: { color: '#888', fontSize: 14, marginTop: 2 },
  bold: { fontWeight: '700', color: '#fff' },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { color: '#666', fontSize: 12 },
  badge: {
    backgroundColor: '#00C853',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#000', fontSize: 11, fontWeight: '700' },
  matchBtn: {
    backgroundColor: '#00C853',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  matchText: { color: '#000', fontWeight: '600', fontSize: 13 },
  followingBtn: {
    backgroundColor: '#1C1C22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followingText: { color: '#00C853', fontSize: 13, fontWeight: '500' },
});
