/**
 * pinInteraction.machine.spec.ts
 *
 * Locks B/C pin ladder: stages, dual-mode guards, thread ids on mutual/match.
 * Actors are provided mocks — no network.
 */
import {createActor, fromPromise, waitFor} from 'xstate';
import type {PublicUserProfile} from '@g88/shared';
import {pinInteractionMachine} from './pinInteraction.machine';
import type {PeerMode, RelationshipSnapshot, ViewerMode} from './pinInteraction.types';

const emptyRel: RelationshipSnapshot = {
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

function mockProfile(id: string, extra?: Partial<PublicUserProfile>): PublicUserProfile {
  return {
    id,
    displayName: 'Test',
    avatarUrl: null,
    bio: null,
    verification: 'none',
    idVerified: false,
    distanceMeters: 120,
    blockedByViewer: false,
    relationship: {canMessage: 'none', matched: false},
    ...extra,
  } as PublicUserProfile;
}

function machineWithActors(opts?: {
  mutualWave?: boolean;
  conversationId?: string | null;
  matchedLike?: boolean;
  datingConversationId?: string | null;
  peerMode?: PeerMode;
  loadError?: boolean;
}) {
  const peerMode = opts?.peerMode ?? 'both';
  return pinInteractionMachine.provide({
    actors: {
      loadPin: fromPromise(async ({input}) => {
        if (opts?.loadError) {
          throw new Error('load failed');
        }
        return {
          profile: mockProfile(input.pinId),
          peerMode,
          distanceMeters: 120,
          relationship: {...emptyRel},
        };
      }),
      sendWave: fromPromise(async () => ({
        mutual: opts?.mutualWave === true,
        conversationId:
          opts?.conversationId !== undefined
            ? opts.conversationId
            : opts?.mutualWave
              ? 'conv-mutual'
              : null,
      })),
      sendLike: fromPromise(async () => ({
        matched: opts?.matchedLike === true,
        datingConversationId:
          opts?.datingConversationId !== undefined
            ? opts.datingConversationId
            : opts?.matchedLike
              ? 'dating-conv-1'
              : null,
      })),
      pass: fromPromise<{ok: true}, {pinId: string}>(async () => ({ok: true})),
      block: fromPromise<{ok: true}, {pinId: string}>(async () => ({ok: true})),
    },
  });
}

function pinTap(
  viewerMode: ViewerMode = 'social',
  pinId = 'u1',
): {
  type: 'PIN_TAP';
  pinId: string;
  pinType: 'user';
  lat: number;
  lng: number;
  viewerMode: ViewerMode;
} {
  return {
    type: 'PIN_TAP',
    pinId,
    pinType: 'user',
    lat: 43.2,
    lng: 27.9,
    viewerMode,
  };
}

async function toPreview(
  actor: ReturnType<typeof createActor>,
): Promise<void> {
  await waitFor(actor, (s) => s.matches('preview'), {timeout: 2000});
}

describe('pinInteractionMachine', () => {
  it('starts in idle', () => {
    const actor = createActor(machineWithActors());
    actor.start();
    expect(actor.getSnapshot().matches('idle')).toBe(true);
    actor.stop();
  });

  it('PIN_TAP → loadingPin → preview with load data', async () => {
    const actor = createActor(machineWithActors({peerMode: 'both'}));
    actor.start();
    actor.send(pinTap('social'));
    expect(actor.getSnapshot().matches('loadingPin')).toBe(true);
    await toPreview(actor);
    const ctx = actor.getSnapshot().context;
    expect(ctx.pinId).toBe('u1');
    expect(ctx.stage).toBe('preview');
    expect(ctx.peerMode).toBe('both');
    expect(ctx.distanceMeters).toBe(120);
    expect(ctx.profile?.id).toBe('u1');
    actor.stop();
  });

  it('load failure → error; RETRY → loadingPin', async () => {
    const actor = createActor(machineWithActors({loadError: true}));
    actor.start();
    actor.send(pinTap());
    await waitFor(actor, (s) => s.matches('error'), {timeout: 2000});
    expect(actor.getSnapshot().context.error).toMatch(/load failed/);
    actor.send({type: 'RETRY'});
    expect(actor.getSnapshot().matches('loadingPin')).toBe(true);
    actor.stop();
  });

  it('OPEN_DETAIL → detailSheet; OPEN_FULL → fullProfile; BACK → detailSheet', async () => {
    const actor = createActor(machineWithActors());
    actor.start();
    actor.send(pinTap('social'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    expect(actor.getSnapshot().matches({detailSheet: 'branch'}) || actor.getSnapshot().matches('social')).toBe(
      true,
    );
    await waitFor(
      actor,
      (s) => s.matches({social: 'viewing'}) || s.matches('social'),
      {timeout: 1000},
    );
    expect(actor.getSnapshot().context.stage).toBe('detail');
    actor.send({type: 'OPEN_FULL'});
    expect(actor.getSnapshot().matches('fullProfile')).toBe(true);
    expect(actor.getSnapshot().context.stage).toBe('full');
    actor.send({type: 'BACK'});
    await waitFor(
      actor,
      (s) => s.matches({social: 'viewing'}) || s.matches('social'),
      {timeout: 1000},
    );
    expect(actor.getSnapshot().context.stage).toBe('detail');
    actor.stop();
  });

  it('QUICK_WAVE blocked when waveSent (canWave false)', async () => {
    const actor = createActor(machineWithActors());
    actor.start();
    actor.send(pinTap('social'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({social: 'viewing'}), {timeout: 1000});
    actor.send({type: 'SEND_WAVE'});
    await waitFor(actor, (s) => s.matches({social: 'waveSent'}), {timeout: 2000});
    const before = actor.getSnapshot().value;
    actor.send({type: 'QUICK_WAVE'});
    expect(actor.getSnapshot().value).toEqual(before);
    actor.stop();
  });

  it('social: SEND_WAVE non-mutual → waveSent + conversationId null', async () => {
    const actor = createActor(
      machineWithActors({mutualWave: false, conversationId: null}),
    );
    actor.start();
    actor.send(pinTap('social'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({social: 'viewing'}), {timeout: 1000});
    actor.send({type: 'SEND_WAVE'});
    await waitFor(actor, (s) => s.matches({social: 'waveSent'}), {timeout: 2000});
    const ctx = actor.getSnapshot().context;
    expect(ctx.waveSent).toBe(true);
    expect(ctx.hasMutualWave).toBe(false);
    expect(ctx.lastResult).toBe('wave_sent');
    expect(ctx.conversationId).toBeNull();
    actor.stop();
  });

  it('social: SEND_WAVE mutual → mutualWave + conversationId', async () => {
    const actor = createActor(
      machineWithActors({
        mutualWave: true,
        conversationId: 'conv-abc',
      }),
    );
    actor.start();
    actor.send(pinTap('social'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({social: 'viewing'}), {timeout: 1000});
    actor.send({type: 'SEND_WAVE'});
    await waitFor(actor, (s) => s.matches({social: 'mutualWave'}), {
      timeout: 2000,
    });
    const ctx = actor.getSnapshot().context;
    expect(ctx.waveSent).toBe(true);
    expect(ctx.hasMutualWave).toBe(true);
    expect(ctx.canMessage).toBe('chat');
    expect(ctx.conversationId).toBe('conv-abc');
    actor.stop();
  });

  it('social: WAVE_MUTUAL from waveSent → mutualWave', async () => {
    const actor = createActor(machineWithActors({mutualWave: false}));
    actor.start();
    actor.send(pinTap('social'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({social: 'viewing'}), {timeout: 1000});
    actor.send({type: 'SEND_WAVE'});
    await waitFor(actor, (s) => s.matches({social: 'waveSent'}), {timeout: 2000});
    actor.send({type: 'WAVE_MUTUAL'});
    expect(actor.getSnapshot().matches({social: 'mutualWave'})).toBe(true);
    expect(actor.getSnapshot().context.hasMutualWave).toBe(true);
    actor.stop();
  });

  it('dating: SEND_LIKE matched → matched + datingConversationId', async () => {
    const actor = createActor(
      machineWithActors({
        peerMode: 'both',
        matchedLike: true,
        datingConversationId: 'dating-xyz',
      }),
    );
    actor.start();
    actor.send(pinTap('dating'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({dating: 'viewing'}), {timeout: 1000});
    actor.send({type: 'SEND_LIKE'});
    await waitFor(actor, (s) => s.matches({dating: 'matched'}), {timeout: 2000});
    const ctx = actor.getSnapshot().context;
    expect(ctx.likeSent).toBe(true);
    expect(ctx.isMatch).toBe(true);
    expect(ctx.lastResult).toBe('matched');
    expect(ctx.datingConversationId).toBe('dating-xyz');
    actor.stop();
  });

  it('dating: SEND_LIKE non-match → liked; MATCH_CREATED → matched + id', async () => {
    const actor = createActor(
      machineWithActors({
        peerMode: 'both',
        matchedLike: false,
        datingConversationId: null,
      }),
    );
    actor.start();
    actor.send(pinTap('dating'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({dating: 'viewing'}), {timeout: 1000});
    actor.send({type: 'SEND_LIKE'});
    await waitFor(actor, (s) => s.matches({dating: 'liked'}), {timeout: 2000});
    expect(actor.getSnapshot().context.likeSent).toBe(true);
    expect(actor.getSnapshot().context.isMatch).toBe(false);
    actor.send({type: 'MATCH_CREATED', datingConversationId: 'dating-ws'});
    await waitFor(actor, (s) => s.matches({dating: 'matched'}), {timeout: 1000});
    expect(actor.getSnapshot().context.isMatch).toBe(true);
    expect(actor.getSnapshot().context.datingConversationId).toBe('dating-ws');
    actor.stop();
  });

  it('dating: PASS → passed → idle', async () => {
    const actor = createActor(machineWithActors({peerMode: 'both'}));
    actor.start();
    actor.send(pinTap('dating'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({dating: 'viewing'}), {timeout: 1000});
    actor.send({type: 'PASS'});
    await waitFor(actor, (s) => s.matches('idle'), {timeout: 2000});
    actor.stop();
  });

  it('LAYER_CHANGED resets to idle', async () => {
    const actor = createActor(machineWithActors());
    actor.start();
    actor.send(pinTap('social'));
    await toPreview(actor);
    actor.send({type: 'LAYER_CHANGED', viewerMode: 'dating'});
    expect(actor.getSnapshot().matches('idle')).toBe(true);
    expect(actor.getSnapshot().context.pinId).toBe('');
    actor.stop();
  });

  it('DISMISS resets to idle from preview', async () => {
    const actor = createActor(machineWithActors());
    actor.start();
    actor.send(pinTap('social'));
    await toPreview(actor);
    actor.send({type: 'DISMISS'});
    expect(actor.getSnapshot().matches('idle')).toBe(true);
    actor.stop();
  });

  it('PIN_TAP from preview switches pin (root handler)', async () => {
    const actor = createActor(machineWithActors());
    actor.start();
    actor.send(pinTap('social', 'u1'));
    await toPreview(actor);
    actor.send(pinTap('social', 'u2'));
    expect(actor.getSnapshot().matches('loadingPin')).toBe(true);
    await toPreview(actor);
    expect(actor.getSnapshot().context.pinId).toBe('u2');
    actor.stop();
  });

  it('canLike false when peerMode is social-only', async () => {
    const actor = createActor(machineWithActors({peerMode: 'social'}));
    actor.start();
    actor.send(pinTap('dating'));
    await toPreview(actor);
    actor.send({type: 'OPEN_DETAIL'});
    await waitFor(actor, (s) => s.matches({dating: 'viewing'}), {timeout: 1000});
    actor.send({type: 'SEND_LIKE'});
    expect(actor.getSnapshot().matches({dating: 'viewing'})).toBe(true);
    expect(actor.getSnapshot().context.likeSent).toBe(false);
    actor.stop();
  });
});
