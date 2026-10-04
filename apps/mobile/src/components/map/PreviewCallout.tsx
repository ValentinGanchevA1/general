import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {IdentityBlock} from '@/components/IdentityBlock';
import {colors} from '@/theme';
import type { VerificationLevel } from '@g88/shared';
import type {ViewerMode} from '@/features/map/pinInteraction.types';
import {styles} from './PreviewCallout.styles';

export interface PreviewCalloutProps {
  /** Display name from pin meta or loaded profile. */
  name: string;
  avatarUrl?: string | null;
  /** e.g. "240 m" or "1.2 km". */
  distanceLabel?: string | null;
  /** Age when known (optional). */
  age?: number | null;
  online?: boolean;
  idVerified?: boolean;
  verification?: VerificationLevel;
  /** Active map interaction mode. */
  viewerMode: ViewerMode;
  /** Peer allows dating interactions. */
  peerAllowsDating: boolean;
  /** True while wave/like request is in flight. */
  pending?: boolean;
  /** Wave already sent (social). */
  waveSent?: boolean;
  /** Like already sent (dating). */
  likeSent?: boolean;
  /** Viewer or peer blocked. */
  blocked?: boolean;
  onQuickWave?: () => void;
  onQuickLike?: () => void;
  onOpenDetail?: () => void;
  onDismiss?: () => void;
}

function formatSubtitle(age?: number | null, distanceLabel?: string | null): string | null {
  const parts: string[] = [];
  if (age != null && age > 0) parts.push(String(age));
  if (distanceLabel) parts.push(distanceLabel);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Stage-1 floating map callout for pin interaction.
 * Quick Wave (social) or Like (dating) + Open detail.
 * Driven by pinInteraction machine state; no internal side-effects.
 */
export function PreviewCallout({
  name,
  avatarUrl,
  distanceLabel,
  age,
  online,
  idVerified = false,
  verification = 'none',
  viewerMode,
  peerAllowsDating,
  pending = false,
  waveSent = false,
  likeSent = false,
  blocked = false,
  onQuickWave,
  onQuickLike,
  onOpenDetail,
  onDismiss,
}: PreviewCalloutProps): React.JSX.Element {
  const subtitle = useMemo(
    () => formatSubtitle(age, distanceLabel),
    [age, distanceLabel],
  );

  const showWave =
    viewerMode === 'social' && !blocked && !waveSent && Boolean(onQuickWave);
  const showLike =
    viewerMode === 'dating' &&
    peerAllowsDating &&
    !blocked &&
    !likeSent &&
    Boolean(onQuickLike);

  const primaryLabel = (() => {
    if (pending) return '…';
    if (viewerMode === 'dating') {
      if (likeSent) return 'Liked';
      if (!peerAllowsDating) return 'Open';
      return 'Like';
    }
    if (waveSent) return 'Waved';
    return 'Wave';
  })();

  const onPrimary = (): void => {
    if (pending || blocked) return;
    if (viewerMode === 'dating') {
      if (peerAllowsDating && !likeSent && onQuickLike) {
        onQuickLike();
        return;
      }
      onOpenDetail?.();
      return;
    }
    if (!waveSent && onQuickWave) {
      onQuickWave();
      return;
    }
    onOpenDetail?.();
  };

  const primaryDisabled =
    pending ||
    blocked ||
    (viewerMode === 'social' && waveSent) ||
    (viewerMode === 'dating' && (likeSent || !peerAllowsDating));

  const primaryA11y =
    viewerMode === 'dating'
      ? likeSent
        ? 'Already liked'
        : peerAllowsDating
          ? 'Like'
          : 'Open profile'
      : waveSent
        ? 'Already waved'
        : 'Wave';

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.header}>
        <View style={styles.identity}>
          <IdentityBlock
            name={name}
            avatarUrl={avatarUrl}
            verification={verification}
            idVerified={idVerified}
            online={online}
            subtitle={subtitle}
            ringVariant={idVerified ? 'verified' : 'brand'}
            size={44}
            onPress={onOpenDetail}
            accessibilityLabel={`Open detail for ${name}`}
          />
        </View>
        {onDismiss ? (
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          >
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.actions}>
        {(showWave || showLike || viewerMode === 'dating') && (
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              viewerMode === 'dating' ? styles.likeBtn : styles.waveBtn,
              primaryDisabled ? styles.btnDisabled : undefined,
            ]}
            onPress={onPrimary}
            disabled={primaryDisabled && !onOpenDetail}
            accessibilityRole="button"
            accessibilityLabel={primaryA11y}
          >
            {pending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.openBtn}
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel="Open detail"
        >
          <Text style={styles.openBtnText}>Open</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
