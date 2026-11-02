import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useMachine} from '@xstate/react';

import type {EntityPoint, VerificationLevel} from '@g88/shared';
import {formatNexaSpatialDistance} from '@/components/map/nexaSpatialSheet';
import {nexaHaptics} from '@/haptics/nexaHaptics';
import {openViaRef} from '@/navigation/openRootScreen';
import {
  peekPendingMapFocus,
  subscribePendingMapFocus,
} from '@/navigation/pendingMapFocus';
import {resolveMapInteractionState} from './mapInteractionState';
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
  const detailRequestedPinIdRef = useRef<string | null>(null);
  const seedPointRef = useRef<(EntityPoint & {kind: 'user'}) | null>(null);
  const consumedMapFocusTokenRef = useRef<number | null>(null);

  // Layer switch must reset open preview / sheet context.
  useEffect(() => {
    detailRequestedPinIdRef.current = null;
    seedPointRef.current = null;
    send({type: 'LAYER_CHANGED', viewerMode});
  }, [viewerMode, send]);

  const openUserPin = useCallback(
    (point: EntityPoint & {kind: 'user'}) => {
      // User-pin taps are a direct sheet interaction. Keep privacy-safe
      // discovery metadata available immediately while the richer profile loads.
      seedPointRef.current = point;
      detailRequestedPinIdRef.current = point.id;
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

  // "View on map" uses the existing pending-focus handoff. Mirror that user
  // focus into the pin machine so the sheet and its action state always target
  // the same peer, even when Main/Map is already mounted under UserProfile.
  useEffect(() => {
    const syncPendingUserFocus = (): void => {
      const pending = peekPendingMapFocus();
      if (
        pending == null ||
        pending.userId == null ||
        pending.userId === '' ||
        pending.lat == null ||
        pending.lng == null ||
        !Number.isFinite(pending.lat) ||
        !Number.isFinite(pending.lng) ||
        consumedMapFocusTokenRef.current === pending.token
      ) {
        return;
      }
      consumedMapFocusTokenRef.current = pending.token;
      openUserPin({
        kind: 'user',
        id: pending.userId,
        lat: pending.lat,
        lng: pending.lng,
        meta: {
          displayName: pending.displayName ?? 'User',
          avatarUrl: pending.avatarUrl ?? null,
          verification: pending.verification ?? 'none',
          online: pending.online ?? false,
          lastSeenAt: pending.lastSeenAt ?? null,
        },
      });
    };

    syncPendingUserFocus();
    return subscribePendingMapFocus(syncPendingUserFocus);
  }, [openUserPin]);

  const dismiss = useCallback(() => {
    detailRequestedPinIdRef.current = null;
    seedPointRef.current = null;
    send({type: 'DISMISS'});
  }, [send]);

  const openDetail = useCallback(() => {
    const pinId = state.context.pinId;
    if (!pinId) return;
    if (state.matches('loadingPin')) {
      detailRequestedPinIdRef.current = pinId;
      return;
    }
    detailRequestedPinIdRef.current = null;
    send({type: 'OPEN_DETAIL'});
  }, [send, state]);

  /** Stage 3: sheet → full UserProfile (machine fullProfile + root handoff). */
  const openFull = useCallback(() => {
    const pinId = state.context.pinId;
    send({type: 'OPEN_FULL'});
    if (pinId) openViaRef('UserProfile', {userId: pinId});
  }, [send, state.context.pinId]);

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

  const previewRequested = state.matches('preview') || state.matches('loadingPin');
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
  const seedPoint =
    seedPointRef.current?.id === ctx.pinId ? seedPointRef.current : null;

  // Complete the machine transition after hydration, but do not couple the
  // actual BottomSheetModal presentation to this network boundary.
  useEffect(() => {
    const pinId = ctx.pinId;
    if (!pinId || detailRequestedPinIdRef.current !== pinId) return;
    if (!state.matches('preview')) return;
    detailRequestedPinIdRef.current = null;
    send({type: 'OPEN_DETAIL'});
  }, [ctx.pinId, send, state]);

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

  const interactionState = resolveMapInteractionState({
    previewRequested,
    isDetail,
    isFull,
  });

  const previewProps = useMemo(() => {
    // PinInteractionHost is intentionally invisible; this object is its one-shot
    // signal that the selected peer is safe to hand off to EntityBottomSheet.
    // Seed metadata lets that handoff happen during loadingPin instead of waiting
    // on the richer /users/:id response.
    if (
      interactionState !== 'quick_peek' ||
      !ctx.pinId ||
      (activeProfile == null && seedPoint == null)
    ) {
      return null;
    }

    const name = activeProfile != null &&
      'displayName' in activeProfile &&
      typeof activeProfile.displayName === 'string'
      ? activeProfile.displayName
      : seedPoint?.meta.displayName ?? 'User';
    const distanceLabel = formatNexaSpatialDistance(ctx.distanceMeters);
    const peerAllowsDating =
      ctx.peerMode === 'dating' || ctx.peerMode === 'both';

    const rawAvatar = activeProfile != null && 'avatarUrl' in activeProfile
      ? (activeProfile.avatarUrl as string | null | undefined)
      : seedPoint?.meta.avatarUrl ?? null;

    const online = activeProfile != null &&
      'online' in activeProfile &&
      typeof activeProfile.online === 'boolean'
      ? activeProfile.online
      : seedPoint?.meta.online;

    const verification = activeProfile != null && 'verification' in activeProfile
      ? activeProfile.verification
      : seedPoint?.meta.verification;

    return {
      name,
      avatarUrl: rawAvatar ?? null,
      distanceLabel,
      age:
        activeProfile != null &&
        'age' in activeProfile &&
        typeof activeProfile.age === 'number'
          ? activeProfile.age
          : null,
      ...(online !== undefined ? {online} : {}),
      idVerified:
        activeProfile != null && 'idVerified' in activeProfile
          ? Boolean(activeProfile.idVerified)
          : false,
      verification: asVerificationLevel(verification),
      viewerMode: ctx.viewerMode,
      peerAllowsDating,
      pending,
      waveSent: waveOptimistic,
      likeSent: ctx.likeSent,
      blocked: ctx.blockedByViewer || ctx.blockedByPeer,
    };
  }, [interactionState, ctx, activeProfile, seedPoint, pending, waveOptimistic]);

  /** Display name for seeding EntityBottomSheet when pin left the viewport. */
  const seedDisplayName = useMemo(() => {
    const profile = activeProfile;
    if (profile && 'displayName' in profile && typeof profile.displayName === 'string') {
      return profile.displayName;
    }
    return seedPoint?.meta.displayName ?? 'User';
  }, [activeProfile, seedPoint]);

  return {
    state,
    interactionState,
    send,
    openUserPin,
    dismiss,
    openDetail,
    openFull,
    backFromFull,
    quickWave,
    quickLike,
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
