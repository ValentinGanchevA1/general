import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import type { VerificationUpdatedEvent } from '@g88/shared';

export function useVerificationSocket() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setIsConnected(false);
      return;
    }

    const socket: Socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001/admin', {
      auth: { token },
      reconnection: true,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('verification:updated', (data: VerificationUpdatedEvent) => {
      queryClient.setQueryData(['verifications', 'pending'], (old: unknown) => {
        if (!old || typeof old !== 'object' || !('items' in old)) return old;
        const typed = old as { items: { id: string }[]; total?: number };
        const items = typed.items.filter((item) => item.id !== data.id);
        return {
          ...typed,
          items,
          total: typeof typed.total === 'number' ? Math.max(0, typed.total - 1) : items.length,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['verifications', 'pending'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return { isConnected };
}
