export interface HelpFaq {
  q: string;
  a: string;
}

export const NEXA_HELP_FAQS: HelpFaq[] = [
  {
    q: 'How does NEXA know who is nearby?',
    a: 'While the app is open, your device shares an approximate location (coarsened to about a 120-meter area). We use it for the map, Pulse stories, and nearby activity. Your exact position is never stored.',
  },
  {
    q: 'How do I hide myself from the map?',
    a: 'Open You → My map presence and turn map presence off. You stay logged in and can still browse; others will not see you in nearby discovery.',
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
    a: 'Create a listing (for sale or wanted) from the map or Marketplace. Nearby people can message the seller, wave, or make an offer and counter. Meet in public places; NEXA does not process payments.',
  },
  {
    q: 'I found a bug or something feels wrong.',
    a: 'Use Email support below with what you were doing and a screenshot if you can. We read every report.',
  },
];
