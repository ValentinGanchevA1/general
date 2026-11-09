export interface HelpFaq {
  q: string;
  a: string;
}

export const NEXA_HELP_FAQS: HelpFaq[] = [
  {
    q: 'How does NEXUS know who is nearby?',
    a: 'While the app is open, your precise GPS is sent securely to the server and coarsened for map discovery, so other people see only an approximate location. Sharing live location in a one-to-one chat is a separate opt-in feature: your chat partner sees exact coordinates, which are stored for the session and in the initial chat message.',
  },
  {
    q: 'How do I hide myself from the map?',
    a: 'Open Identity → Settings → Appear on map and turn it off. You stay logged in and can still browse; others will not see you in nearby discovery.',
  },
  {
    q: 'What is Pulse?',
    a: 'Pulse shows live local activity around you. Use it to scan nearby stories, events, and other local signals; relationship activity and chats live in Connections.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories are visible to people nearby and disappear after 24 hours. You can post a photo or a short video. Posting needs a verified email and an account at least 24 hours old (phone-verified accounts can post sooner). Reactions on stories count like waves toward mutual interest.',
  },
  {
    q: 'What is Connections?',
    a: 'Connections is where relationship activity and chats return. Activity surfaces items that need your attention, while Chats keeps your conversations and authoritative unread state together. Use the Map for spatial discovery.',
  },
  {
    q: 'Is NEXUS an 18+ app? Who can use Dating?',
    a: 'NEXUS is primarily a local social app, not a dating-only service. General social features are not automatically restricted to adults. Optional Dating and matchmaking are reserved for users aged 18 or older, but are temporarily unavailable during early access while stronger age checks are prepared. A birth date entered in your profile is not independent proof of age. We are reviewing additional protections for younger users before launch.',
  },
  {
    q: 'How do friends and online status work?',
    a: 'Send or accept a friend request from a profile. Friends can appear with a distinct map style. Online status is shown only to friends, and only if you allow it in Settings → Friends can see when I’m online. Unfriending does not remove mutual follows.',
  },
  {
    q: 'How do I find someone on the map?',
    a: 'From a profile use View on map when they have a public pin. From a wave or match, open their profile or use View on map when available. The map centers on their coarsened pin and opens their card when available.',
  },
  {
    q: 'What do the verification badges mean?',
    a: 'They show completed verification signals such as email, phone, or government ID. They do not create a public trust or popularity score. Manage verification in Trust Center. Email verification unlocks story posting. ID review is assisted by automated face checks and always finished by a human.',
  },
  {
    q: 'How does local trade work?',
    a: 'Create a listing (for sale or wanted) from the map or Marketplace. Nearby people can message the seller, wave, or make an offer and counter. Meet in public places; NEXUS does not process payments.',
  },
  {
    q: 'I found a bug or something feels wrong.',
    a: 'Use Email support below with what you were doing and a screenshot if you can. We read every report.',
  },
];
