import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import type { VerificationUpdatedEvent } from '@g88/shared';

export function useVerificationSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket: Socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000/admin', {
      auth: { token: localStorage.getItem('token') }, // Or from context
      reconnection: true,
    });

    socket.on('connect', () => console.log('Admin WS connected'));

    socket.on('verification:updated', (data: VerificationUpdatedEvent) => {
      // Update list cache
      queryClient.setQueryData(['verifications', 'pending'], (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.filter((item: any) => item.id !== data.id),
        };
      });

      // Optional: Invalidate detail if open
      queryClient.invalidateQueries({ queryKey: ['verifications', data.id] });
    });

   return () => {
     socket.disconnect();
   };
  }, [queryClient]);
}
