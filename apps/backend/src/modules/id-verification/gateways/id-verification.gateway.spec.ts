import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

import { IdVerificationGateway } from './id-verification.gateway';

interface SocketHarness {
  socket: Socket;
  join: jest.Mock;
  disconnect: jest.Mock;
}

function createSocket(token?: string): SocketHarness {
  const join = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn();
  const socket = {
    handshake: { auth: token ? { token } : {} },
    join,
    disconnect,
  } as unknown as Socket;
  return { socket, join, disconnect };
}

describe('IdVerificationGateway admin authorization', () => {
  const originalAdminIds = process.env.ADMIN_USER_IDS;
  const originalJwtSecret = process.env.JWT_SECRET;
  let verify: jest.Mock;
  let gateway: IdVerificationGateway;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'admin-1';
    process.env.JWT_SECRET = 'test-secret';
    verify = jest.fn();
    gateway = new IdVerificationGateway({ verify } as unknown as JwtService);
  });

  afterEach(() => {
    if (originalAdminIds === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = originalAdminIds;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it('disconnects clients with no token', () => {
    const { socket, join, disconnect } = createSocket();

    gateway.handleConnection(socket);

    expect(verify).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects clients with an invalid JWT', () => {
    verify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const { socket, join, disconnect } = createSocket('bad-token');

    gateway.handleConnection(socket);

    expect(join).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects authenticated users who are not admins', () => {
    verify.mockReturnValue({ sub: 'user-2' });
    const { socket, join, disconnect } = createSocket('valid-token');

    gateway.handleConnection(socket);

    expect(join).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('joins only configured admins to the admins room', () => {
    verify.mockReturnValue({ sub: 'admin-1' });
    const { socket, join, disconnect } = createSocket('valid-token');

    gateway.handleConnection(socket);

    expect(verify).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
    expect(join).toHaveBeenCalledWith('admins');
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('emits verification updates only to the admins room', () => {
    const roomEmit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit: roomEmit });
    const globalEmit = jest.fn();
    gateway.server = { to, emit: globalEmit } as unknown as IdVerificationGateway['server'];

    gateway.emitVerificationUpdate({
      id: 'verification-1',
      userId: 'user-1',
      status: 'pending',
    });

    expect(to).toHaveBeenCalledWith('admins');
    expect(roomEmit).toHaveBeenCalledWith('verification:updated', {
      id: 'verification-1',
      userId: 'user-1',
      status: 'pending',
    });
    expect(globalEmit).not.toHaveBeenCalled();
  });
});
