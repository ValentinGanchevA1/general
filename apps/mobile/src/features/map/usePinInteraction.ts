import {useCallback, useEffect, useMemo} from 'react';
import {useMachine} from '@xstate/react';

import type {EntityPoint} from '@g88/shared';
import {pinInteractionMachine} from './pinInteraction.machine';
import type {ViewerMode} from './pinInteraction.types';

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

  const quickWave = useCallback(() => {
    send({type: 'QUICK_WAVE'});
  }, [send]);

  const quickLike = useCallback(() => {
    send({type: 'QUICK_LIKE'});
  }, [send]);

  const showPreview = state.matches('preview') || state.matches('loadingPin');
  const pending =
    state.matches('social.wavePending') || state.matches('dating.likePending');

  const ctx = state.context;

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

    return {
      name,
      avatarUrl:
        profile && 'avatarUrl' in profile
          ? (profile.avatarUrl as string | null | undefined)
          : null,
      distanceLabel,
      age:
        profile && 'age' in profile && typeof profile.age === 'number'
          ? profile.age
          : null,
      online:
        profile && 'online' in profile
          ? (profile.online as boolean | undefined)
          : undefined,
      idVerified:
        profile && 'idVerified' in profile
          ? Boolean(profile.idVerified)
          : false,
      verification:
        (profile &&
          'verification' in profile &&
          (profile.verification as
            | 'none'
            | 'email'
            | 'phone'
            | 'id'
            | 'social')) ||
        'none',
      viewerMode: ctx.viewerMode,
      peerAllowsDating,
      pending,
      waveSent: ctx.waveSent,
      likeSent: ctx.likeSent,
      blocked: ctx.blockedByViewer || ctx.blockedByPeer,
    };
  }, [showPreview, ctx, pending]);

  return {
    state,
    send,
    openUserPin,
    dismiss,
    openDetail,
    quickWave,
    quickLike,
    showPreview,
    previewProps,
    /** Pin id currently in machine context (for sheet handoff). */
    activePinId: ctx.pinId || null,
    stage: ctx.stage,
    isDetail: state.matches('detailSheet') || state.matches('fullProfile'),
  };
}
