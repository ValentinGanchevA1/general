import type { PublicUserProfile, RelationshipSummary, UserProfile } from '@g88/shared';

import {
  friendLabelFromRel,
  mapPublicToViewModel,
  mapSelfToViewModel,
} from './mapToProfileViewModel';

function basePublic(over: Partial<PublicUserProfile> = {}): PublicUserProfile {
  return {
    id: 'u1',
    displayName: 'Ada',
    bio: null,
    avatarUrl: null,
    coverUrl: null,
    verification: 'email',
    verificationScore: 20,
    idVerified: false,
    goals: [],
    online: false,
    ...over,
  };
}

function baseSelf(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'me',
    displayName: 'Me',
    email: 'me@test.local',
    verification: 'phone',
    avatarUrl: null,
    bio: null,
    visibility: 'public',
    goals: [],
    interests: [],
    profileComplete: true,
    phone: null,
    age: 28,
    dateOfBirth: '1998-01-01',
    hometownCity: 'Sofia',
    hometownCountry: 'BG',
    showAge: true,
    showHometown: true,
    gender: 'woman',
    genderSelfDescribe: null,
    sexualOrientation: 'straight',
    orientationSelfDescribe: null,
    nationality: 'BG',
    showGender: true,
    showOrientation: false,
    showNationality: true,
    openToDating: false,
    seekingGenders: [],
    friendsSeeOnlineStatus: true,
    photoUrls: [],
    coverUrl: null,
    subscriptionTier: 'free',
    socialLinks: [],
    verificationScore: 40,
    badges: {
      email: true,
      phone: true,
      photo: false,
      id: false,
      social: false,
      premium: false,
      verified: false,
    },
    idVerificationStatus: 'none',
    verifiedBadge: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('mapPublicToViewModel', () => {
  it('formats identity from public fields and leaves interests empty', () => {
    const vm = mapPublicToViewModel(
      basePublic({
        gender: 'woman',
        nationality: 'BG',
        sexualOrientation: 'bisexual',
        goals: ['networking'],
        verificationScore: 0,
      }),
      { rel: null, friendLabel: 'Add friend' },
    );
    expect(vm.identityLine).toContain('Woman');
    expect(vm.identityLine).toContain('Bisexual');
    expect(vm.identityLine).toContain('BG');
    expect(vm.goals).toEqual(['networking']);
    expect(vm.interests).toEqual([]);
    expect(vm.verificationScore).toBe(0);
    expect(vm.friendState).toBe('none');
    expect(vm.mutualFriendsCount).toBe(0);
  });

  it('maps relationship + blocked + canMessage', () => {
    const rel: RelationshipSummary = {
      state: 'friends',
      mutualFriendsCount: 3,
      isFollowing: true,
      isFollowedBy: true,
    };
    const vm = mapPublicToViewModel(
      basePublic({
        blockedByViewer: true,
        relationship: { matched: true, sharedInterests: [], canMessage: 'chat' },
        distanceMeters: 420,
        online: true,
        status: {
          level: 4,
          xpIntoLevel: 10,
          xpForNextLevel: 100,
          currentStreak: 2,
          allTimeRank: 12,
          achievementIcons: ['🏆'],
        },
      }),
      { rel, friendLabel: 'Friends', blocked: true },
    );
    expect(vm.blocked).toBe(true);
    expect(vm.canMessage).toBe('chat');
    expect(vm.matched).toBe(true);
    expect(vm.mutualFriendsCount).toBe(3);
    expect(vm.isFollowing).toBe(true);
    expect(vm.friendState).toBe('friends');
    expect(vm.friendLabel).toBe('Friends');
    expect(vm.distanceMeters).toBe(420);
    expect(vm.online).toBe(true);
    expect(vm.status?.level).toBe(4);
    expect(vm.status?.allTimeRank).toBe(12);
    expect(vm.status?.achievementIcons).toEqual(['🏆']);
  });

  it('builds hometown line from city + country', () => {
    const vm = mapPublicToViewModel(
      basePublic({ hometownCity: 'Plovdiv', hometownCountry: 'BG' }),
      { rel: null, friendLabel: 'Add friend' },
    );
    expect(vm.hometownLine).toBe('Plovdiv, BG');
  });
});

describe('mapSelfToViewModel', () => {
  it('applies show_* gates for identity and hometown', () => {
    const hidden = mapSelfToViewModel(baseSelf({ showGender: false, showNationality: false, showOrientation: false, showHometown: false, showAge: false }), {
      photoUrls: ['https://x/a.jpg'],
      tierLabel: 'Free',
      isPaid: false,
      mapVisible: true,
    });
    expect(hidden.identityLine).toBeNull();
    expect(hidden.hometownLine).toBeNull();
    expect(hidden.age).toBeNull();
    expect(hidden.photoUrls).toEqual(['https://x/a.jpg']);
    expect(hidden.mapVisible).toBe(true);
    expect(hidden.idVerified).toBe(false);

    const shown = mapSelfToViewModel(baseSelf(), {
      photoUrls: [],
      tierLabel: 'Premium',
      isPaid: true,
      mapVisible: false,
    });
    // orientation hidden by default flag
    expect(shown.identityLine).toBe('Woman · BG');
    expect(shown.hometownLine).toBe('Sofia, BG');
    expect(shown.age).toBe(28);
    expect(shown.isPaid).toBe(true);
    expect(shown.tierLabel).toBe('Premium');
    expect(shown.mapVisible).toBe(false);
  });

  it('treats idVerificationStatus verified as idVerified', () => {
    const vm = mapSelfToViewModel(
      baseSelf({ idVerificationStatus: 'verified' }),
      { photoUrls: [], tierLabel: null, isPaid: false, mapVisible: true },
    );
    expect(vm.idVerified).toBe(true);
  });
});

describe('friendLabelFromRel', () => {
  it('maps relationship states to labels', () => {
    expect(friendLabelFromRel(null)).toBe('Add friend');
    expect(friendLabelFromRel({ state: 'friends', mutualFriendsCount: 0, isFollowing: true, isFollowedBy: true })).toBe('Friends');
    expect(friendLabelFromRel({ state: 'request_outgoing', mutualFriendsCount: 0, isFollowing: false, isFollowedBy: false })).toBe('Requested');
    expect(friendLabelFromRel({ state: 'request_incoming', mutualFriendsCount: 0, isFollowing: false, isFollowedBy: false })).toBe('Accept');
    expect(friendLabelFromRel({ state: 'none', mutualFriendsCount: 0, isFollowing: false, isFollowedBy: false })).toBe('Add friend');
  });
});
