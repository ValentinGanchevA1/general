import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('realtime conversation recipient privacy', () => {
  const source = readFileSync(join(__dirname, 'realtime.gateway.ts'), 'utf8');

  it('rechecks membership and symmetric blocks when joining', () => {
    expect(source).toContain('authorizedConversationRecipients(payload.conversationId)).includes(client.data.userId)');
    expect(source).toContain('FROM user_blocks b');
    expect(source).toContain('unnest(c.participant_ids)');
  });

  it('routes precise location updates through authorized user rooms, not stale conversation rooms', () => {
    const handler = source.split("@SubscribeMessage('location:share:update')")[1]!
      .split("@SubscribeMessage('location:share:stop')")[0]!;
    expect(handler).toContain('authorizedConversationRecipients(conversationId)');
    expect(handler).toContain('this.userRoom(userId)');
    expect(handler).not.toContain('this.server.to(this.conversationRoom(conversationId)).emit');
  });

  it('does not fall back to a stale conversation room when chat recipient lookup fails', () => {
    const handler = source.split('private async emitChatMessageToParticipants(')[1]!
      .split('private async pushToOfflineParticipants(')[0]!;
    expect(handler).toContain('authorizedConversationRecipients');
    expect(handler).toContain('this.userRoom(userId)');
    expect(handler).not.toContain('this.conversationRoom(');
  });
});
