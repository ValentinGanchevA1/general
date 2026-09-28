import { resolveUserPrimaryCta } from './resolveUserPrimaryCta';

describe('resolveUserPrimaryCta', () => {
  it('returns loading when relationship unknown', () => {
    expect(resolveUserPrimaryCta({ relationshipKnown: false })).toEqual({
      kind: 'loading',
      label: '',
    });
  });

  it('returns none when blocked', () => {
    expect(
      resolveUserPrimaryCta({
        relationshipKnown: true,
        blocked: true,
        canMessage: 'chat',
      }),
    ).toEqual({ kind: 'none', label: '' });
  });

  it('returns message when canMessage is chat', () => {
    expect(
      resolveUserPrimaryCta({
        relationshipKnown: true,
        canMessage: 'chat',
      }),
    ).toEqual({ kind: 'message', label: 'Message' });
  });

  it('returns message when matched even if request', () => {
    expect(
      resolveUserPrimaryCta({
        relationshipKnown: true,
        matched: true,
        canMessage: 'request',
      }),
    ).toEqual({ kind: 'message', label: 'Message' });
  });

  it('returns wave when only request permission', () => {
    expect(
      resolveUserPrimaryCta({
        relationshipKnown: true,
        canMessage: 'request',
        waveAvailable: true,
      }),
    ).toEqual({ kind: 'wave', label: 'Wave' });
  });

  it('returns wave when canMessage none', () => {
    expect(
      resolveUserPrimaryCta({
        relationshipKnown: true,
        canMessage: 'none',
      }),
    ).toEqual({ kind: 'wave', label: 'Wave' });
  });

  it('returns none when wave unavailable and no chat', () => {
    expect(
      resolveUserPrimaryCta({
        relationshipKnown: true,
        canMessage: 'none',
        waveAvailable: false,
      }),
    ).toEqual({ kind: 'none', label: '' });
  });
});
