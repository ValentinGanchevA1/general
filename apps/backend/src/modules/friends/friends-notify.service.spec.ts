import { FriendsNotifyService } from './friends-notify.service';

describe('FriendsNotifyService', () => {
  const db = { query: jest.fn() };
  const notifications = {
    notifyFriendRequest: jest.fn(),
    notifyFriendAccepted: jest.fn(),
  };
  const realtime = {
    emitFriendRequest: jest.fn(),
    emitFriendAccepted: jest.fn(),
  };
  let service: FriendsNotifyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FriendsNotifyService(
      db as never,
      notifications as never,
      realtime as never,
    );
  });

  it('explicitly casts actor parameter to UUID and JSON userId to text when request is accepted', async () => {
    db.query.mockResolvedValueOnce([{ id: 'peer-uuid', display_name: 'Peer', avatar_url: null }]);

    await service.onRequestAccepted('requester-uuid', 'peer-uuid');

    expect(db.query).toHaveBeenCalledTimes(2);
    const [sql, params] = db.query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('$2::uuid');
    expect(sql).toContain("'userId', $2::uuid::text");
    expect(params).toEqual([
      'requester-uuid',
      'peer-uuid',
      'peer-uuid:requester-uuid',
    ]);
    expect(realtime.emitFriendAccepted).toHaveBeenCalledWith(
      'requester-uuid',
      expect.objectContaining({ peerUserId: 'peer-uuid' }),
    );
    expect(notifications.notifyFriendAccepted).toHaveBeenCalled();
  });

  it('does not emit accepted notifications if peer lookup returns no user', async () => {
    db.query.mockResolvedValueOnce([]);

    await service.onRequestAccepted('requester-uuid', 'missing-peer');

    expect(realtime.emitFriendAccepted).not.toHaveBeenCalled();
    expect(notifications.notifyFriendAccepted).not.toHaveBeenCalled();
  });
});
