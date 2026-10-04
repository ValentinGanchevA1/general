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
  // openToDating is owner-only on UserProfile; public profile may omit it.
  // Dating layer only shows peers who are open_to_dating → treat as 'both'.
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

/** Real wave — same endpoint as EntityBottomSheet / MapScreen onWave. */
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

/** Dating like — backend ships with migration 0047. */
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

const passActor = fromPromise<void, {pinId: string}>(async ({input}) => {
  await postJson<{toUserId: string}, {ok: true}>('/dating/pass', {
    toUserId: input.pinId,
  });
});

const blockActor = fromPromise<void, {pinId: string}>(async ({input}) => {
  await postJson<undefined, {blocked: boolean}>(
    `/blocks/${input.pinId}`,
    undefined,
  );
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
        error: undefined,
        lastResult: undefined,
        waveSent: false,
        hasMutualWave: false,
        likeSent: false,
        isMatch: false,
        passed: false,
        superLiked: false,
        blockedByViewer: false,
        blockedByPeer: false,
        canMessage: 'none' as const,
        isFriend: false,
        profile: undefined,
        peerMode: 'none' as const,
      };
    }),
    setWaveSent: assign({waveSent: true, lastResult: 'wave_sent' as const}),
    setLikeSent: assign({likeSent: true, lastResult: 'like_sent' as const}),
    setMatched: assign({isMatch: true, lastResult: 'matched' as const}),
    setPassed: assign({passed: true, lastResult: 'passed' as const}),
    setBlocked: assign({blockedByViewer: true, lastResult: 'blocked' as const}),
    setMutualWave: assign({
      hasMutualWave: true,
      canMessage: 'chat' as const,
    }),
    resetToIdle: assign({
      pinId: '',
      pinType: 'user' as const,
      stage: 'preview' as const,
      error: undefined,
      lastResult: undefined,
      profile: undefined,
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
    // Accept PIN_TAP from any state so switching pins while preview/sheet open works.
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
            profile: event.output.profile,
            peerMode: event.output.peerMode,
            distanceMeters: event.output.distanceMeters,
            ...event.output.relationship,
            stage: 'preview' as const,
            error: undefined,
          })),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({event}) =>
              event.error instanceof Error
                ? event.error.message
                : 'Failed to load pin',
          }),
        },
      },
    },

    preview: {
      entry: assign({stage: 'preview'}),
      on: {
        OPEN_DETAIL: 'detailSheet',
        QUICK_WAVE: {
          guard: 'canWave',
          target: 'social.wavePending',
        },
        QUICK_LIKE: {
          guard: 'canLike',
          target: 'dating.likePending',
        },
      },
    },

    detailSheet: {
      entry: assign({stage: 'detail'}),
      initial: 'branch',
      states: {
        branch: {
          always: [
            {guard: 'isDatingMode', target: '#pinInteraction.dating.viewing'},
            {target: '#pinInteraction.social.viewing'},
          ],
        },
      },
      on: {
        OPEN_FULL: 'fullProfile',
        BACK: 'preview',
      },
    },

    fullProfile: {
      entry: assign({stage: 'full'}),
      on: {
        BACK: 'detailSheet',
        SEND_WAVE: {guard: 'canWave', target: 'social.wavePending'},
        SEND_LIKE: {guard: 'canLike', target: 'dating.likePending'},
        PASS: {guard: 'isDatingMode', target: 'dating.passed'},
        MESSAGE: [
          {guard: 'canMessageDating', target: 'dating.messaging'},
          {guard: 'canMessageSocial', target: 'social.messaging'},
        ],
        BLOCK: 'blocking',
      },
    },

    social: {
      initial: 'viewing',
      states: {
        viewing: {
          on: {
            SEND_WAVE: {guard: 'canWave', target: 'wavePending'},
            MESSAGE: {guard: 'canMessageSocial', target: 'messaging'},
            BLOCK: '#pinInteraction.blocking',
          },
        },
        wavePending: {
          invoke: {
            src: 'sendWave',
            input: ({context}) => ({pinId: context.pinId}),
            onDone: [
              {
                guard: ({event}) => event.output.mutual === true,
                target: 'mutualWave',
                actions: ['setWaveSent', 'setMutualWave'],
              },
              {
                target: 'waveSent',
                actions: 'setWaveSent',
              },
            ],
            onError: {
              target: 'viewing',
              actions: assign({
                error: ({event}) =>
                  event.error instanceof Error
                    ? event.error.message
                    : 'Wave failed',
              }),
            },
          },
        },
        waveSent: {
          on: {
            WAVE_MUTUAL: {target: 'mutualWave', actions: 'setMutualWave'},
            MESSAGE: {guard: 'canMessageSocial', target: 'messaging'},
          },
        },
        mutualWave: {
          entry: 'setMutualWave',
          on: {
            MESSAGE: 'messaging',
          },
        },
        messaging: {
          entry: assign({lastResult: 'message_opened'}),
        },
      },
    },

    dating: {
      initial: 'viewing',
      states: {
        viewing: {
          on: {
            SEND_LIKE: {guard: 'canLike', target: 'likePending'},
            PASS: 'passed',
            MESSAGE: {guard: 'canMessageDating', target: 'messaging'},
            BLOCK: '#pinInteraction.blocking',
          },
        },
        likePending: {
          invoke: {
            src: 'sendLike',
            input: ({context}) => ({pinId: context.pinId}),
            onDone: [
              {
                guard: ({event}) => event.output.matched === true,
                target: 'matched',
                actions: ['setLikeSent', 'setMatched'],
              },
              {
                target: 'liked',
                actions: 'setLikeSent',
              },
            ],
            onError: {
              target: 'viewing',
              actions: assign({
                error: ({event}) =>
                  event.error instanceof Error
                    ? event.error.message
                    : 'Like failed',
              }),
            },
          },
        },
        liked: {
          on: {
            MATCH_CREATED: {target: 'matched', actions: 'setMatched'},
          },
        },
        matched: {
          entry: 'setMatched',
          on: {
            MESSAGE: 'messaging',
          },
        },
        messaging: {
          entry: assign({lastResult: 'message_opened'}),
        },
        passed: {
          entry: 'setPassed',
          invoke: {
            src: 'pass',
            input: ({context}) => ({pinId: context.pinId}),
            onDone: {target: '#pinInteraction.idle'},
            onError: {target: '#pinInteraction.idle'},
          },
        },
      },
    },

    blocking: {
      invoke: {
        src: 'block',
        input: ({context}) => ({pinId: context.pinId}),
        onDone: {target: 'idle', actions: 'setBlocked'},
        onError: {
          target: 'detailSheet',
          actions: assign({
            error: ({event}) =>
              event.error instanceof Error
                ? event.error.message
                : 'Block failed',
          }),
        },
      },
    },

    error: {
      on: {
        RETRY: 'loadingPin',
      },
    },
  },
});
