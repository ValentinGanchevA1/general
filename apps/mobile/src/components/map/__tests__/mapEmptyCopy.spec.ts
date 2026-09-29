import { mapEmptyCopy } from '@/components/map/mapEmptyCopy';

const base = {
  friendsOnly: false,
  datingOnly: false,
  openToDating: false,
  listingMode: 'all' as const,
  emailVerified: true,
};

describe('mapEmptyCopy', () => {
  it('friendsOnly beats datingOnly', () => {
    const r = mapEmptyCopy({
      ...base,
      friendsOnly: true,
      datingOnly: true,
      openToDating: false,
    });
    expect(r.actionKind).toBe('show_everyone');
  });

  it('datingOnly + !openToDating → dating_prefs', () => {
    const r = mapEmptyCopy({
      ...base,
      datingOnly: true,
      openToDating: false,
    });
    expect(r.actionKind).toBe('dating_prefs');
    expect(r.actionLabel).toBe('Dating preferences');
  });

  it('datingOnly + openToDating → clear_dating', () => {
    const r = mapEmptyCopy({
      ...base,
      datingOnly: true,
      openToDating: true,
    });
    expect(r.actionKind).toBe('clear_dating');
    expect(r.actionLabel).toBe('Clear Dating filter');
  });

  it('default create when email verified', () => {
    const r = mapEmptyCopy(base);
    expect(r.actionKind).toBe('create');
  });

  it('verify_email when not verified and not dating', () => {
    const r = mapEmptyCopy({ ...base, emailVerified: false });
    expect(r.actionKind).toBe('verify_email');
  });
});
