import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { ChatRealtimeAccessService } from './chat-realtime-access.service';

const CONVERSATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_C = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('ChatRealtimeAccessService', () => {
  let service: ChatRealtimeAccessService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        ChatRealtimeAccessService,
        { provide: getDataSourceToken(), useValue: { query } },
      ],
    }).compile();
    service = mod.get(ChatRealtimeAccessService);
  });

  it('returns active normalized group members when the group has no blocked pair', async () => {
    query.mockResolvedValueOnce([
      {
        kind: 'group',
        participant_ids: [USER_A, USER_B, USER_C],
        blocked_pair: false,
      },
    ]);

    await expect(service.getRecipientIds(CONVERSATION_ID)).resolves.toEqual([
      USER_A,
      USER_B,
      USER_C,
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('cm.left_at IS NULL'),
      [CONVERSATION_ID],
    );
    expect(query.mock.calls[0]?.[0]).toEqual(expect.stringContaining('conversation_members'));
    expect(query.mock.calls[0]?.[0]).toEqual(expect.stringContaining('user_blocks'));
  });

  it('fails the whole group fanout closed when any active member pair is blocked', async () => {
    query.mockResolvedValueOnce([
      {
        kind: 'group',
        participant_ids: [USER_A, USER_B, USER_C],
        blocked_pair: true,
      },
    ]);

    await expect(service.getRecipientIds(CONVERSATION_ID)).resolves.toEqual([]);
  });

  it('preserves direct-message recipients when no block exists', async () => {
    query.mockResolvedValueOnce([
      {
        kind: 'dm',
        participant_ids: [USER_A, USER_B],
        blocked_pair: false,
      },
    ]);

    await expect(service.getRecipientIds(CONVERSATION_ID)).resolves.toEqual([USER_A, USER_B]);
  });

  it('keeps precise-location recipient resolution DM-only', async () => {
    query.mockResolvedValueOnce([
      {
        kind: 'group',
        participant_ids: [USER_A, USER_B],
        blocked_pair: false,
      },
    ]);

    await expect(service.getRecipientIds(CONVERSATION_ID, true)).resolves.toEqual([]);
  });

  it('fails closed when the conversation does not exist', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.getRecipientIds(CONVERSATION_ID)).resolves.toEqual([]);
  });
});
