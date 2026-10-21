import type { TrustNextStep } from '@g88/shared';

import {
  NEXA_ACTION_LANGUAGE,
  resolveNexaConnectActionLabel,
  resolveNexaOfferActionLabel,
  resolveNexaRetryActionLabel,
  resolveNexaRsvpActionLabel,
  resolveNexaTrustActionLabel,
  resolveNexaVerifyActionLabel,
} from './nexaActionLanguage';

describe('NEXA action language v2', () => {
  it('keeps the six canonical product intents stable', () => {
    expect(Object.keys(NEXA_ACTION_LANGUAGE)).toEqual([
      'discover',
      'connect',
      'join',
      'offer',
      'verify',
      'retry',
    ]);
    expect(NEXA_ACTION_LANGUAGE.discover.emphasis).toBe('discovery');
    expect(NEXA_ACTION_LANGUAGE.connect.emphasis).toBe('primary');
    expect(NEXA_ACTION_LANGUAGE.retry.emphasis).toBe('secondary');
  });

  it('uses concrete connect verbs instead of vague social-network copy', () => {
    expect(resolveNexaConnectActionLabel('wave')).toBe('Wave');
    expect(resolveNexaConnectActionLabel('message')).toBe('Message');
    expect(resolveNexaConnectActionLabel('profile')).toBe('Connect profile');
  });

  it('presents event going as Join until the RSVP is confirmed', () => {
    expect(resolveNexaRsvpActionLabel('going', false)).toBe('Join');
    expect(resolveNexaRsvpActionLabel('going', true)).toBe('Going');
    expect(resolveNexaRsvpActionLabel('maybe', false)).toBe('Maybe');
    expect(resolveNexaRsvpActionLabel('declined', false)).toBe("Can't go");
  });

  it('uses truthful marketplace verbs at each offer stage', () => {
    expect(resolveNexaOfferActionLabel('start')).toBe('Make offer');
    expect(resolveNexaOfferActionLabel('submit')).toBe('Send offer');
    expect(resolveNexaOfferActionLabel('counter')).toBe('Send counter');
    expect(resolveNexaOfferActionLabel('accept')).toBe('Accept offer');
  });

  it('uses verify language consistently across the trust ladder', () => {
    expect(resolveNexaVerifyActionLabel('email')).toBe('Verify email');
    expect(resolveNexaVerifyActionLabel('phone')).toBe('Verify phone');
    expect(resolveNexaVerifyActionLabel('id')).toBe('Verify identity');
    expect(resolveNexaVerifyActionLabel('id', 'retry')).toBe('Try identity verification again');
  });

  it('derives trust CTAs without depending on legacy ctaLabel wording', () => {
    const next: TrustNextStep = {
      step: 'id',
      kind: 'actionable',
      title: 'Resubmit ID',
      detail: 'Previous submission was rejected',
      ctaLabel: 'Resubmit',
      nav: 'VerificationId',
    };

    expect(resolveNexaTrustActionLabel(next, 'rejected')).toBe('Try identity verification again');
    expect(resolveNexaTrustActionLabel(next, 'none')).toBe('Verify identity');
  });

  it('keeps retry wording contextual without exposing implementation details', () => {
    expect(resolveNexaRetryActionLabel()).toBe('Try again');
    expect(resolveNexaRetryActionLabel('discovery')).toBe('Retry discovery');
    expect(resolveNexaRetryActionLabel('profile')).toBe('Retry profile');
  });
});
