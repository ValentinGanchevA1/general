import 'reflect-metadata';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { AuthService } from './auth.service';

// Mock the OAuth client at the module boundary rather than spying on an
// overloaded method whose callback signature is not a Jest Promise overload.
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-123',
        email: 'alice@example.test',
        email_verified: true,
      }),
    }),
  })),
}));

describe('AuthService — new accounts are private', () => {
  it('explicitly creates email accounts private, independent of the DB default', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new AuthService(
      { query } as unknown as DataSource,
      {} as JwtService,
    );

    // No returned user prevents token issuing; the INSERT is still inspected.
    await expect(service.register('alice@example.test', 'Pass1234!', 'Alice'))
      .rejects.toThrow('Failed to create user account');
    expect(query).toHaveBeenCalledTimes(1);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('display_name, visibility');
    expect(sql).toContain("VALUES ($1, $2, $3, 'private')");
  });

  it('explicitly creates new Google OAuth accounts private', async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'google-test-client';
    try {
      const query = jest.fn().mockResolvedValue([]);
      const service = new AuthService(
        { query } as unknown as DataSource,
        {} as JwtService,
      );
      await expect(service.googleOAuth('mock-id-token'))
        .rejects.toThrow('Failed to create Google OAuth account');
      const insert = query.mock.calls.find(
        (call: unknown[]) => String(call[0]).includes('INSERT INTO users'),
      );
      expect(insert).toBeDefined();
      expect(String(insert?.[0])).toContain('email_verified_at, visibility');
      expect(String(insert?.[0])).toContain("'email', NOW(), 'private'");
    } finally {
      if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  });
});
