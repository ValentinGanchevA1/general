import type { GroupConversationSummary } from '@g88/shared';

import { groupChatRouteStore } from './groupChatRouteStore';

const GROUP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const group: GroupConversationSummary = {
  id: GROUP_ID,
  kind: 'group',
  title: 'Weekend crew',
  createdBy: OTHER_ID,
  members: [],
  lastMessageAt: null,
  lastMessage: null,
  unreadCount: 0,
};

describe('groupChatRouteStore', () => {
  beforeEach(() => {
    groupChatRouteStore.clear();
  });

  it('hands the matching group off exactly once', () => {
    groupChatRouteStore.set(group);

    expect(groupChatRouteStore.take(GROUP_ID)).toEqual(group);
    expect(groupChatRouteStore.take(GROUP_ID)).toBeNull();
  });

  it('does not consume a pending group for another conversation', () => {
    groupChatRouteStore.set(group);

    expect(groupChatRouteStore.take(OTHER_ID)).toBeNull();
    expect(groupChatRouteStore.take(GROUP_ID)).toEqual(group);
  });
});
