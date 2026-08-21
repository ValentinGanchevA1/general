import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type { ListPendingResponseDto, VerificationUpdatedEvent } from '@g88/shared';
import { getAccessToken } from '@/lib/auth-storage';
import { pendingVerificationsPrefix } from '../query-keys';

/**
 * Resolve Socket.IO base URL for the /admin namespace.
 * Prefer VITE_WS_URL; else derive host from VITE_API_URL; else same hostname
 * as the page (so 127.0.0.1:5173 talks to 127.0.0.1:3001, not localhost).
 * localhost ≠ 127.0.0.1 for browsers (CORS + mixed identity).
 */
function resolveAdminWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL as string;
  }
  const api = (import.meta.env.VITE_API_URL as string | undefined) || '';
  try {
    if (api) {
      const u = new URL(api);
      return `${u.protocol}//${u.host}/admin`;
    }
  } catch {
    // fall through
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001/admin`;
  }
  return 'http://127.0.0.1:3001/admin';
}

export function useVerificationSocket() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsConnected(false);
      return;
    }

    const url = resolveAdminWsUrl();
    const socket: Socket = io(url, {
      auth: { token },
      reconnection: true,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      if (import.meta.env.DEV) {
        console.warn('[admin-ws] connect_error', err.message, 'url=', url);
      }
      setIsConnected(false);
    });

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
