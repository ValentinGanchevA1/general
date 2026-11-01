import { resolveGroupMemberAction } from './groupMemberActions';

describe('resolveGroupMemberAction', () => {
  const viewerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const targetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  it('always allows the active viewer to leave themselves', () => {
    expect(resolveGroupMemberAction(viewerId, 'member', viewerId, 'member')).toBe('leave');
    expect(resolveGroupMemberAction(viewerId, 'admin', viewerId, 'admin')).toBe('leave');
    expect(resolveGroupMemberAction(viewerId, 'owner', viewerId, 'owner')).toBe('leave');
  });

  it('allows an owner to remove admins and members but not another owner', () => {
    expect(resolveGroupMemberAction(viewerId, 'owner', targetId, 'admin')).toBe('remove');
    expect(resolveGroupMemberAction(viewerId, 'owner', targetId, 'member')).toBe('remove');
    expect(resolveGroupMemberAction(viewerId, 'owner', targetId, 'owner')).toBeNull();
  });

  it('allows an admin to remove members only', () => {
    expect(resolveGroupMemberAction(viewerId, 'admin', targetId, 'member')).toBe('remove');
    expect(resolveGroupMemberAction(viewerId, 'admin', targetId, 'admin')).toBeNull();
    expect(resolveGroupMemberAction(viewerId, 'admin', targetId, 'owner')).toBeNull();
  });

  it('does not let a regular member remove another member', () => {
    expect(resolveGroupMemberAction(viewerId, 'member', targetId, 'member')).toBeNull();
  });
});
