/**
 * Pin interaction state machine (Social Wave + Dating Like/Match).
 *
 * Product rules (locked):
 * - viewerMode is exclusive toggle (map layer)
 * - Dating layer hides non open_to_dating peers
 * - People layer shows them but only Wave (no Like)
 * - Mutual like opens separate dating chat thread
 * - Super Like reserved in context, no UI in v1
 * - LAYER_CHANGED resets to idle
 * - PIN_TAP accepted from any state (switch pin while preview/sheet open)
 * - C3: OPEN_FULL from detail/viewing → fullProfile; BACK restores detailSheet
 * - B: sheet CTAs use SEND_WAVE / SEND_LIKE / PASS (same actors as quick)
 * - C: conversationId / datingConversationId stored for Chat handoff
 */
import {assign, fromPromise, setup} from 'xstate';
import type {
  PeerMode,
  PinContext,
  PinEvent,
  RelationshipSnapshot,
  ViewerMode,
} from './pinInteraction.types';
import type {
  LikeRequest,
  LikeResponse,
  PublicUserProfile,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';
import {getJson, postJson} from '@/api/client';

function peerModeFromProfile(
  profile: PublicUserProfile,
  viewerMode: ViewerMode,
): PeerMode {
  const explicit =
    'openToDating' in profile
      ? (profile as PublicUserProfile & {openToDating?: boolean}).openToDating
      : undefined;
  if (explicit === true) return 'both';
  if (explicit === undefined && viewerMode === 'dating') return 'both';
  return 'social';
}

function relationshipFromProfile(profile: PublicUserProfile): RelationshipSnapshot {
  const rel = profile.relationship;
  return {
    waveSent: false,
    hasMutualWave: rel?.matched === true,
    canMessage: rel?.canMessage ?? 'none',
    isFriend: false,
    blockedByViewer: profile.blockedByViewer === true,
    blockedByPeer: false,
    likeSent: false,
    isMatch: false,
    passed: false,
  };
}

const loadPinActor = fromPromise<
  {
    profile: PublicUserProfile;
    peerMode: PeerMode;
    distanceMeters?: number;
    relationship: RelationshipSnapshot;
  },
  {pinId: string; viewerMode: ViewerMode}
>(async ({input}) => {
  const profile = await getJson<PublicUserProfile>(`/users/${input.pinId}`);
  const peerMode = peerModeFromProfile(profile, input.viewerMode);
  const relationship = relationshipFromProfile(profile);
  return {
    profile,
    peerMode,
    ...(profile.distanceMeters != null
      ? {distanceMeters: profile.distanceMeters}
      : {}),
    relationship,
  };
});

const sendWaveActor = fromPromise<
  {mutual: boolean; conversationId: string | null},
  {pinId: string}
>(async ({input}) => {
  const res = await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
    toUserId: input.pinId,
    context: 'map',
  });
  return {
    mutual: res.conversationId != null,
    conversationId: res.conversationId,
  };
});

const sendLikeActor = fromPromise<
  {matched: boolean; datingConversationId: string | null},
  {pinId: string}
>(async ({input}) => {
  const res = await postJson<LikeRequest, LikeResponse>('/dating/likes', {
    toUserId: input.pinId,
  });
  return {
    matched: res.matched,
    datingConversationId: res.datingConversationId,
  };
});

const passActor = fromPromise<{ok: true}, {pinId: string}>(async ({input}) => {
  await postJson<{toUserId: string}, {ok: true}>('/dating/pass', {
    toUserId: input.pinId,
  });
  return {ok: true as const};
});

const blockActor = fromPromise<{ok: true}, {pinId: string}>(async ({input}) => {
  await postJson<undefined, {blocked: boolean}>(
    `/blocks/${input.pinId}`,
    undefined,
  );
  return {ok: true as const};
});

export const pinInteractionMachine = setup({
  types: {
    context: {} as PinContext,
    events: {} as PinEvent,
  },
  actors: {
    loadPin: loadPinActor,
    sendWave: sendWaveActor,
    sendLike: sendLikeActor,
    pass: passActor,
    block: blockActor,
  },
  guards: {
    isDatingMode: ({context}) => context.viewerMode === 'dating',
    canWave: ({context}) =>
      context.viewerMode === 'social' &&
      !context.waveSent &&
      !context.blockedByViewer &&
      !context.blockedByPeer,
    canLike: ({context}) =>
      context.viewerMode === 'dating' &&
      (context.peerMode === 'dating' || context.peerMode === 'both') &&
      !context.likeSent &&
      !context.passed &&
      !context.blockedByViewer &&
      !context.blockedByPeer,
    canMessageSocial: ({context}) =>
      context.hasMutualWave || context.canMessage === 'chat',
    canMessageDating: ({context}) => context.isMatch,
  },
  actions: {
    assignPin: assign(({event}) => {
      if (event.type !== 'PIN_TAP') return {};
      return {
        pinId: event.pinId,
        pinType: event.pinType,
        lat: event.lat,
        lng: event.lng,
        viewerMode: event.viewerMode,
        stage: 'preview' as const,
        waveSent: false,
        hasMutualWave: false,
        likeSent: false,
        isMatch: false,
        passed: false,
        superLiked: false,
        conversationId: null as string | null,
        datingConversationId: null as string | null,
        blockedByViewer: false,
        blockedByPeer: false,
        canMessage: 'none' as const,
        isFriend: false,
        peerMode: 'none' as const,
      };
    }),
    setWaveSent: assign({waveSent: true, lastResult: 'wave_sent' as const}),
    setLikeSent: assign({likeSent: true, lastResult: 'like_sent' as const}),
    setMatched: assign({isMatch: true, lastResult: 'matched' as const}),
    setPassed: assign({passed: true, lastResult: 'passed' as const}),
    clearThreadIds: assign({
      conversationId: null as string | null,
      datingConversationId: null as string | null,
    }),
    setBlocked: assign({blockedByViewer: true, lastResult: 'blocked' as const}),
    setMutualWave: assign({
      hasMutualWave: true,
      canMessage: 'chat' as const,
    }),
    resetToIdle: assign({
      pinId: '',
      pinType: 'user' as const,
      stage: 'preview' as const,
      waveSent: false,
      hasMutualWave: false,
      likeSent: false,
      isMatch: false,
      passed: false,
      superLiked: false,
      conversationId: null as string | null,
      datingConversationId: null as string | null,
      blockedByViewer: false,
      blockedByPeer: false,
      canMessage: 'none' as const,
      isFriend: false,
      peerMode: 'none' as const,
    }),
  },
}).createMachine({
  id: 'pinInteraction',
  initial: 'idle',
  context: {
    pinId: '',
    pinType: 'user',
    lat: 0,
    lng: 0,
    viewerMode: 'social',
    peerMode: 'none',
    waveSent: false,
    hasMutualWave: false,
    canMessage: 'none',
    isFriend: false,
    blockedByViewer: false,
    blockedByPeer: false,
    likeSent: false,
    superLiked: false,
    isMatch: false,
    passed: false,
    stage: 'preview',
  },
  on: {
    PIN_TAP: {
      target: '.loadingPin',
      actions: 'assignPin',
    },
    LAYER_CHANGED: {
      target: '.idle',
      actions: 'resetToIdle',
    },
    DISMISS: {
      target: '.idle',
      actions: 'resetToIdle',
    },
    USER_BLOCKED: {
      actions: 'setBlocked',
    },
    PEER_MODE_CHANGED: {
      actions: assign({
        peerMode: ({event}) => event.peerMode,
      }),
    },
  },
  states: {
    idle: {},
    loadingPin: {
      invoke: {
        src: 'loadPin',
        input: ({context}) => ({
          pinId: context.pinId,
          viewerMode: context.viewerMode,
        }),
        onDone: {
          target: 'preview',
          actions: assign(({event}) => ({
            peerMode: event.output.peerMode,
            distanceMeters: event.output.distanceMeters,
            waveSent: event.output.relationship.waveSent,
            hasMutualWave: event.output.relationship.hasMutualWave,
            canMessage: event.output.relationship.canMessage,
            isFriend: event.output.relationship.isFriend,
            blockedByViewer: event.output.relationship.blockedByViewer,
            blockedByPeer: event.output.relationship.blockedByPeer,
            likeSent: event.output.relationship.likeSent,
            isMatch: event.output.relationship.isMatch,
            passed: event.output.relationship.passed,
            displayName: event.output.profile.displayName,
            avatarUrl: event.output.profile.avatarUrl ?? null,
            stage: 'preview' as const,
            lastResult: undefined,
            error: undefined,
          })),
        },
        onError: {
          target: 'idle',
          actions: assign({
            error: 'Failed to load pin',
            lastResult: 'error' as const,
          }),
        },
      },
    },
    preview: {
      on: {
        OPEN_DETAIL: {target: 'detailSheet'},
        QUICK_WAVE: {
          target: 'sendingWave',
          guard: 'canWave',
        },
        QUICK_LIKE: {
          target: 'sendingLike',
          guard: 'canLike',
        },
        PASS: {
          target: 'passing',
          guard: 'canLike',
        },
        BLOCK: {target: 'blocking'},
      },
    },
    detailSheet: {
      entry: assign({stage: 'sheet' as const}),
      on: {
        OPEN_FULL: {target: 'fullProfile'},
        SEND_WAVE: {
          target: 'sendingWave',
          guard: 'canWave',
        },
        SEND_LIKE: {
          target: 'sendingLike',
          guard: 'canLike',
        },
        PASS: {
          target: 'passing',
          guard: 'canLike',
        },
        BLOCK: {target: 'blocking'},
        BACK: {target: 'preview'},
      },
    },
    fullProfile: {
      entry: assign({stage: 'full' as const}),
      on: {
        BACK: {target: 'detailSheet'},
        SEND_WAVE: {
          target: 'sendingWave',
          guard: 'canWave',
        },
        SEND_LIKE: {
          target: 'sendingLike',
          guard: 'canLike',
        },
        PASS: {
          target: 'passing',
          guard: 'canLike',
        },
        BLOCK: {target: 'blocking'},
      },
    },
    sendingWave: {
      invoke: {
        src: 'sendWave',
        input: ({context}) => ({pinId: context.pinId}),
        onDone: [
          {
            guard: ({event}) => event.output.mutual,
            target: 'detailSheet',
            actions: [
              'setWaveSent',
              'setMutualWave',
              assign({
                conversationId: ({event}) => event.output.conversationId,
              }),
            ],
          },
          {
            target: 'detailSheet',
            actions: 'setWaveSent',
          },
        ],
        onError: {
          target: 'detailSheet',
          actions: assign({
            error: 'Wave failed',
            lastResult: 'error' as const,
          }),
        },
      },
    },
    sendingLike: {
      invoke: {
        src: 'sendLike',
        input: ({context}) => ({pinId: context.pinId}),
        onDone: [
          {
            guard: ({event}) => event.output.matched,
            target: 'detailSheet',
            actions: [
              'setLikeSent',
              'setMatched',
              assign({
                datingConversationId: ({event}) =>
                  event.output.datingConversationId,
              }),
            ],
          },
          {
            target: 'detailSheet',
            actions: 'setLikeSent',
          },
        ],
        onError: {
          target: 'detailSheet',
          actions: assign({
            error: 'Like failed',
            lastResult: 'error' as const,
          }),
        },
      },
    },
    passing: {
      invoke: {
        src: 'pass',
        input: ({context}) => ({pinId: context.pinId}),
        onDone: {
          target: 'idle',
          actions: ['setPassed', 'resetToIdle'],
        },
        onError: {
          target: 'detailSheet',
          actions: assign({
            error: 'Pass failed',
            lastResult: 'error' as const,
          }),
        },
      },
    },
    blocking: {
      invoke: {
        src: 'block',
        input: ({context}) => ({pinId: context.pinId}),
        onDone: {
          target: 'idle',
          actions: ['setBlocked', 'resetToIdle'],
        },
        onError: {
          target: 'detailSheet',
          actions: assign({
            error: 'Block failed',
            lastResult: 'error' as const,
          }),
        },
      },
    },
  },
});
