import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('realtime conversation recipient privacy', () => {
  const gatewaySource = readFileSync(join(__dirname, 'realtime.gateway.ts'), 'utf8');
  const accessSource = readFileSync(
    join(__dirname, '../modules/chat/chat-realtime-access.service.ts'),
    'utf8',
  );

  it('rechecks normalized membership and symmetric blocks when joining', () => {
    expect(gatewaySource).toContain(
      'authorizedConversationRecipients(payload.conversationId)',
    );
    expect(accessSource).toContain('conversation_members');
    expect(accessSource).toContain('cm.left_at IS NULL');
    expect(accessSource).toContain('FROM user_blocks b');
    expect(accessSource).toContain("WHEN t.kind = 'group'");
  });

  it('keeps precise location recipient resolution DM-only and off stale conversation rooms', () => {
    const handler = gatewaySource.split("@SubscribeMessage('location:share:update')")[1]!
      .split("@SubscribeMessage('location:share:stop')")[0]!;
    expect(handler).toContain('authorizedConversationRecipients(conversationId, true)');
    expect(handler).toContain('this.userRoom(userId)');
    expect(handler).not.toContain('this.server.to(this.conversationRoom(conversationId)).emit');
  });

  it('does not fall back to a stale conversation room when chat recipient lookup fails', () => {
    const handler = gatewaySource.split('private async emitChatMessageToParticipants(')[1]!
      .split('private async pushToOfflineParticipants(')[0]!;
    expect(handler).toContain('authorizedConversationRecipients');
    expect(handler).toContain('this.userRoom(userId)');
    expect(handler).not.toContain('this.conversationRoom(');
  });

  it('fails an entire realtime recipient set closed when a blocked pair remains', () => {
    expect(accessSource).toContain('if (row == null || row.blocked_pair) return [];');
    expect(accessSource).toContain('b.blocker_id = ANY(r.participant_ids)');
    expect(accessSource).toContain('b.blocked_id = ANY(r.participant_ids)');
  });
});