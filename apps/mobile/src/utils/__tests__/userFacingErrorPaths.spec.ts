declare const __dirname: string;

const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('fs');

const AUDITED_USER_FACING_FILES = [
  '../../components/ErrorBoundary.tsx',
  '../../features/chat/chatSlice.ts',
  '../../features/discovery/useDiscovery.ts',
  '../../features/friends/FriendsSuggestionsRail.tsx',
  '../../features/gifts/SendGiftSheet.tsx',
  '../../features/map/pinInteraction.machine.ts',
  '../../features/profile/useUserProfileScreenData.ts',
  '../../features/pulse/pulseSlice.ts',
  '../../features/stories/components/StoryCreateSheet.tsx',
  '../../features/stories/storiesSlice.ts',
  '../../features/verification/idVerificationSlice.ts',
  '../../features/weather/useCurrentWeather.ts',
  '../../screens/AlertComposerScreen.tsx',
  '../../screens/EventCreateScreen.tsx',
  '../../screens/ListingCreateScreen.tsx',
  '../../screens/ListingDetailScreen.tsx',
  '../../screens/SuggestionsScreen.tsx',
] as const;

const FORBIDDEN_DIRECT_MESSAGE_PATTERNS = [
  /\b(?:e|err|error|cause|lastError)\.message\b/,
  /\baction\.error\.message\b/,
  /as\s+ApiError\)\.message\b/,
] as const;

describe('user-facing error presentation boundary', () => {
  it.each(AUDITED_USER_FACING_FILES)(
    '%s does not bypass extractMessage with a raw error message',
    (relativePath) => {
      const source = readFileSync(`${__dirname}/${relativePath}`, 'utf8');

      for (const pattern of FORBIDDEN_DIRECT_MESSAGE_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    },
  );
});
