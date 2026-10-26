import {createActor, fromPromise, waitFor} from 'xstate';
import type {PublicUserProfile} from '@g88/shared';
import {pinInteractionMachine} from './pinInteraction.machine';
import type {RelationshipSnapshot, ViewerMode} from './pinInteraction.types';

const emptyRelationship: RelationshipSnapshot = {
  waveSent: false,
  hasMutualWave: false,
  canMessage: 'none',
  isFriend: false,
  blockedByViewer: false,
  blockedByPeer: false,
  likeSent: false,
  isMatch: false,
  passed: false,
};

function profile(id: string): PublicUserProfile {
  return {
    id,
    displayName: id,
    avatarUrl: null,
    bio: null,
    verification: 'none',
    idVerified: false,
    distanceMeters: 120,
    blockedByViewer: false,
    relationship: {canMessage: 'none', matched: false},
  } as PublicUserProfile;
}

function pinTap(pinId: string, viewerMode: ViewerMode = 'social') {
  return {
    type: 'PIN_TAP' as const,
    pinId,
    pinType: 'user' as const,
    lat: 43.2,
    lng: 27.9,
    viewerMode,
  };
}

function machineWithConditionalLoad() {
  return pinInteractionMachine.provide({
    actors: {
      loadPin: fromPromise(async ({input}) => {
        if (input.pinId === 'broken') throw new Error('load failed');
        return {
          profile: profile(input.pinId),
          peerMode: 'both' as const,
          distanceMeters: 120,
          relationship: {...emptyRelationship},
        };
      }),
      sendWave: fromPromise(async () => ({
        mutual: false,
        conversationId: null,
      })),
    },
  });
}

describe('pinInteractionMachine ephemeral context', () => {
  it('clears loaded profile and distance immediately when switching pins', async () => {
    const actor = createActor(machineWithConditionalLoad());
    actor.start();
    actor.send(pinTap('u1'));
    await waitFor(actor, (snapshot) => snapshot.matches('preview'), {timeout: 2000});
    expect(actor.getSnapshot().context.profile?.id).toBe('u1');
    expect(actor.getSnapshot().context.distanceMeters).toBe(120);

    actor.send(pinTap('u2'));
    const switching = actor.getSnapshot();
    expect(switching.matches('loadingPin')).toBe(true);
    expect(switching.context.profile).toBeUndefined();
    expect(switching.context.distanceMeters).toBeUndefined();
    actor.stop();
  });

  it('does not carry an old load error into the next pin', async () => {
    const actor = createActor(machineWithConditionalLoad());
    actor.start();
    actor.send(pinTap('broken'));
    await waitFor(actor, (snapshot) => snapshot.matches('error'), {timeout: 2000});
    expect(actor.getSnapshot().context.error).toMatch(/load failed/);

    actor.send(pinTap('u2'));
    expect(actor.getSnapshot().context.error).toBeUndefined();
    await waitFor(actor, (snapshot) => snapshot.matches('preview'), {timeout: 2000});
    expect(actor.getSnapshot().context.profile?.id).toBe('u2');
    actor.stop();
  });

  it('clears the previous action result when switching pins', async () => {
    const actor = createActor(machineWithConditionalLoad());
    actor.start();
    actor.send(pinTap('u1'));
    await waitFor(actor, (snapshot) => snapshot.matches('preview'), {timeout: 2000});
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (snapshot) => snapshot.matches({social: 'viewing'}), {
      timeout: 1000,
    });
    actor.send({type: 'SEND_WAVE'});
    await waitFor(actor, (snapshot) => snapshot.matches({social: 'waveSent'}), {
      timeout: 2000,
    });
    expect(actor.getSnapshot().context.lastResult).toBe('wave_sent');

    actor.send(pinTap('u2'));
    expect(actor.getSnapshot().context.lastResult).toBeUndefined();
    actor.stop();
  });

  it('clears ephemeral pin data on dismiss', async () => {
    const actor = createActor(machineWithConditionalLoad());
    actor.start();
    actor.send(pinTap('u1'));
    await waitFor(actor, (snapshot) => snapshot.matches('preview'), {timeout: 2000});

    actor.send({type: 'DISMISS'});
    const context = actor.getSnapshot().context;
    expect(actor.getSnapshot().matches('idle')).toBe(true);
    expect(context.profile).toBeUndefined();
    expect(context.distanceMeters).toBeUndefined();
    expect(context.error).toBeUndefined();
    expect(context.lastResult).toBeUndefined();
    actor.stop();
  });
});
