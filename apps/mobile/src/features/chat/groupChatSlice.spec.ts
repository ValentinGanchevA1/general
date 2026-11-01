import type { GroupConversationSummary } from '@g88/shared';

import reducer, {
  createGroupConversation,
  fetchGroupConversations,
} from './groupChatSlice';

const GROUP: GroupConversationSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'group',
  title: 'Weekend crew',
  createdBy: '00000000-0000-4000-8000-000000000010',
  members: [],
  lastMessageAt: null,
  lastMessage: null,
  unreadCount: 0,
};

describe('groupChatSlice', () => {
  it('loads group summaries without widening the DM conversation state', () => {
    const pending = reducer(undefined, fetchGroupConversations.pending('load-1', undefined));
    expect(pending.loading).toBe(true);

    const loaded = reducer(
      pending,
      fetchGroupConversations.fulfilled([GROUP], 'load-1', undefined),
    );
    expect(loaded.loading).toBe(false);
    expect(loaded.groups).toEqual([GROUP]);
  });

  it('keeps a failed create error and preserves the existing list', () => {
    const loaded = reducer(
      undefined,
      fetchGroupConversations.fulfilled([GROUP], 'load-1', undefined),
    );
    const request = {
      clientRequestId: '00000000-0000-4000-8000-000000000099',
      title: 'Another group',
      memberIds: [
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ],
    };

    const failed = reducer(
      loaded,
      createGroupConversation.rejected(
        new Error('request failed'),
        'create-1',
        request,
        'Group invitation is not allowed',
      ),
    );

    expect(failed.creating).toBe(false);
    expect(failed.createError).toBe('Group invitation is not allowed');
    expect(failed.groups).toEqual([GROUP]);
  });

  it('upserts the authoritative created group', () => {
    const created = reducer(
      undefined,
      createGroupConversation.fulfilled(
        { conversation: GROUP, reused: false },
        'create-1',
        {
          clientRequestId: '00000000-0000-4000-8000-000000000099',
          title: GROUP.title,
          memberIds: [],
        },
      ),
    );

    expect(created.creating).toBe(false);
    expect(created.groups).toEqual([GROUP]);
  });
});
