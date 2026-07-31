import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type { ListPendingResponseDto, VerificationUpdatedEvent } from '@g88/shared';
import { getAccessToken } from '@/lib/auth-storage';
import { pendingVerificationsPrefix } from '../query-keys';

export function useVerificationSocket() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsConnected(false);
      return;
    }

    const socket: Socket = io(
      import.meta.env.VITE_WS_URL || 'http://localhost:3001/admin',
      {
        auth: { token },
        reconnection: true,
      },
    );

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('verification:updated', (data: VerificationUpdatedEvent) => {
      if (data.status === 'pending') {
        queryClient.invalidateQueries({
          queryKey: [...pendingVerificationsPrefix],
        });
        return;
      }

      queryClient.setQueriesData<ListPendingResponseDto>(
        { queryKey: [...pendingVerificationsPrefix] },
        (old) => {
          if (!old) return old;
          const items = old.items.filter(
            (item) => item.id !== data.id && item.userId !== data.userId,
          );
          return {
            ...old,
            items,
            total: Math.max(0, old.total - 1),
          };
        },
      );
      queryClient.invalidateQueries({
        queryKey: [...pendingVerificationsPrefix],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return { isConnected };
}
