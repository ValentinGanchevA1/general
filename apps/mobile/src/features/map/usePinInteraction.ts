import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useMachine} from '@xstate/react';

import type {EntityPoint, VerificationLevel} from '@g88/shared';
import {formatNexaSpatialDistance} from '@/components/map/nexaSpatialSheet';
import {nexaHaptics} from '@/haptics/nexaHaptics';
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
  const lastHapticErrorRef = useRef<string | null>(null);

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
    nexaHaptics.connect();
    send({type: 'QUICK_WAVE'});
  }, [send]);

  const quickLike = useCallback(() => {
    nexaHaptics.connect();
    send({type: 'QUICK_LIKE'});
  }, [send]);

  /** Sheet / full: machine-owned CTAs (no parallel API in EntityBottomSheet). */
  const sendWave = useCallback(() => {
    nexaHaptics.connect();
    send({type: 'SEND_WAVE'});
  }, [send]);

  const sendLike = useCallback(() => {
    nexaHaptics.connect();
    send({type: 'SEND_LIKE'});
  }, [send]);

  const sendPass = useCallback(() => {
    nexaHaptics.commit();
    send({type: 'PASS'});
  }, [send]);

  const sendMessage = useCallback(() => {
    send({type: 'MESSAGE'});
  }, [send]);

  const showPreview = state.matches('preview') || state.matches('loadingPin');
  const wavePending = state.matches({social: 'wavePending'});
  const pending =
    wavePending ||
    state.matches({dating: 'likePending'});

  const ctx = state.context;
  // PIN_TAP is accepted from every state. During the next pin's loading state,
  // the machine may still carry the previous profile until the actor resolves.
  // Never render that stale identity under the newly selected marker.
  const activeProfile =
    ctx.profile?.id === ctx.pinId ? ctx.profile : undefined;

  // Wave is a lightweight social signal. Reflect the intent immediately while
  // the durable command is in flight, then automatically roll back if the
  // machine returns to viewing after a failed request.
  const waveOptimistic = ctx.waveSent || wavePending;

  useEffect(() => {
    const message = ctx.error?.trim();
    if (!message) {
      lastHapticErrorRef.current = null;
      return;
    }
    if (lastHapticErrorRef.current === message) return;
    lastHapticErrorRef.current = message;
    nexaHaptics.error();
  }, [ctx.error]);

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
    const profile = activeProfile;
    const name =
      profile && 'displayName' in profile && typeof profile.displayName === 'string'
        ? profile.displayName
        : 'User';
    const distanceLabel = formatNexaSpatialDistance(
      profile ? ctx.distanceMeters : undefined,
    );
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
      waveSent: waveOptimistic,
      likeSent: ctx.likeSent,
      blocked: ctx.blockedByViewer || ctx.blockedByPeer,
    };
  }, [showPreview, ctx, activeProfile, pending, waveOptimistic]);

  /** Display name for seeding EntityBottomSheet when pin left the viewport. */
  const seedDisplayName = useMemo(() => {
    const profile = activeProfile;
    if (profile && 'displayName' in profile && typeof profile.displayName === 'string') {
      return profile.displayName;
    }
    return 'User';
  }, [activeProfile]);

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
    waveSent: waveOptimistic,
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