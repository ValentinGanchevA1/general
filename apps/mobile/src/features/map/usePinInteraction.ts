import {useCallback, useEffect, useMemo} from 'react';
import {useMachine} from '@xstate/react';

import type {EntityPoint, VerificationLevel} from '@g88/shared';
import {pinInteractionMachine} from './pinInteraction.machine';
import type {ViewerMode} from './pinInteraction.types';

const VERIFICATION_LEVELS = new Set<VerificationLevel>([
  'none',
  'email',
  'phone',
  'selfie',
  'id',
]);

function asVerificationLevel(value: unknown): VerificationLevel {
  if (typeof value === 'string' && VERIFICATION_LEVELS.has(value as VerificationLevel)) {
    return value as VerificationLevel;
  }
  return 'none';
}

export interface UsePinInteractionOptions {
  /** Current map interaction mode (People vs Dating layer). */
  viewerMode: ViewerMode;
}

export function usePinInteraction({viewerMode}: UsePinInteractionOptions) {
  const [state, send] = useMachine(pinInteractionMachine);

  // Layer switch must reset open preview / sheet context
  useEffect(() => {
    send({type: 'LAYER_CHANGED', viewerMode});
  }, [viewerMode, send]);

  const openUserPin = useCallback(
    (point: EntityPoint & {kind: 'user'}) => {
      send({
        type: 'PIN_TAP',
        pinId: point.id,
        pinType: 'user',
        lat: point.lat,
        lng: point.lng,
        viewerMode,
      });
    },
    [send, viewerMode],
  );

  const dismiss = useCallback(() => {
    send({type: 'DISMISS'});
  }, [send]);

  const openDetail = useCallback(() => {
    send({type: 'OPEN_DETAIL'});
  }, [send]);

  /** Stage 3: sheet → full UserProfile (machine fullProfile). */
  const openFull = useCallback(() => {
    send({type: 'OPEN_FULL'});
  }, [send]);

  /** Stage 3 back: fullProfile → detailSheet (re-present sheet). */
  const backFromFull = useCallback(() => {
    send({type: 'BACK'});
  }, [send]);

  const quickWave = useCallback(() => {
    send({type: 'QUICK_WAVE'});
  }, [send]);

  const quickLike = useCallback(() => {
    send({type: 'QUICK_LIKE'});
  }, [send]);

  /** Sheet / full: machine-owned CTAs (no parallel API in EntityBottomSheet). */
  const sendWave = useCallback(() => {
    send({type: 'SEND_WAVE'});
  }, [send]);

  const sendLike = useCallback(() => {
    send({type: 'SEND_LIKE'});
  }, [send]);

  const sendPass = useCallback(() => {
    send({type: 'PASS'});
  }, [send]);

  const sendMessage = useCallback(() => {
    send({type: 'MESSAGE'});
  }, [send]);

  const showPreview = state.matches('preview') || state.matches('loadingPin');
  const pending =
    state.matches({social: 'wavePending'}) ||
    state.matches({dating: 'likePending'});

  const ctx = state.context;
  const isFull = state.matches('fullProfile');
  // detail stage: keep sheet mounted through pending / sent / matched
  const isDetail =
    state.matches('detailSheet') ||
    (ctx.stage === 'detail' &&
      (state.matches({social: 'viewing'}) ||
        state.matches({social: 'wavePending'}) ||
        state.matches({social: 'waveSent'}) ||
        state.matches({social: 'mutualWave'}) ||
        state.matches({social: 'messaging'}) ||
        state.matches({dating: 'viewing'}) ||
        state.matches({dating: 'likePending'}) ||
        state.matches({dating: 'liked'}) ||
        state.matches({dating: 'matched'}) ||
        state.matches({dating: 'messaging'})));

  const previewProps = useMemo(() => {
    if (!showPreview || !ctx.pinId) return null;
    const profile = ctx.profile;
    const name =
      profile && 'displayName' in profile && typeof profile.displayName === 'string'
        ? profile.displayName
        : 'User';
    const distanceLabel =
      ctx.distanceMeters != null
        ? ctx.distanceMeters < 1000
          ? `${Math.round(ctx.distanceMeters)} m`
          : `${(ctx.distanceMeters / 1000).toFixed(1)} km`
        : null;
    const peerAllowsDating =
      ctx.peerMode === 'dating' || ctx.peerMode === 'both';

    const rawAvatar =
      profile && 'avatarUrl' in profile
        ? (profile.avatarUrl as string | null | undefined)
        : null;

    const online =
      profile && 'online' in profile && typeof profile.online === 'boolean'
        ? profile.online
        : undefined;

    return {
      name,
      avatarUrl: rawAvatar ?? null,
      distanceLabel,
      age:
        profile && 'age' in profile && typeof profile.age === 'number'
          ? profile.age
          : null,
      ...(online !== undefined ? {online} : {}),
      idVerified:
        profile && 'idVerified' in profile
          ? Boolean(profile.idVerified)
          : false,
      verification: asVerificationLevel(
        profile && 'verification' in profile ? profile.verification : undefined,
      ),
      viewerMode: ctx.viewerMode,
      peerAllowsDating,
      pending,
      waveSent: ctx.waveSent,
      likeSent: ctx.likeSent,
      blocked: ctx.blockedByViewer || ctx.blockedByPeer,
    };
  }, [showPreview, ctx, pending]);

  /** Display name for seeding EntityBottomSheet when pin left the viewport. */
  const seedDisplayName = useMemo(() => {
    const profile = ctx.profile;
    if (profile && 'displayName' in profile && typeof profile.displayName === 'string') {
      return profile.displayName;
    }
    return 'User';
  }, [ctx.profile]);

  return {
    state,
    send,
    openUserPin,
    dismiss,
    openDetail,
    openFull,
    backFromFull,
    quickWave,
    quickLike,
    showPreview,
    previewProps,
    /** Pin id currently in machine context (for sheet handoff). */
    activePinId: ctx.pinId || null,
    /** Lat/lng captured at PIN_TAP — seed sheet when peer is off-viewport. */
    pinLat: ctx.pinId ? ctx.lat : null,
    pinLng: ctx.pinId ? ctx.lng : null,
    seedDisplayName,
    stage: ctx.stage,
    isDetail,
    isFull,
    sendWave,
    sendLike,
    sendPass,
    sendMessage,
    pending,
    waveSent: ctx.waveSent,
    likeSent: ctx.likeSent,
    isMatch: ctx.isMatch,
    hasMutualWave: ctx.hasMutualWave,
    passed: ctx.passed,
    conversationId: ctx.conversationId ?? null,
    datingConversationId: ctx.datingConversationId ?? null,
    lastResult: ctx.lastResult,
    machineError: ctx.error,
  };
}
