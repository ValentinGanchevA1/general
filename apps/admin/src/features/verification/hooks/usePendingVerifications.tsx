import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DecideIdVerificationDto,
  ListPendingResponseDto,
  PendingVerificationSummary,
} from '@g88/shared';
import { adminApi } from '../api';
import {
  pendingVerificationsKey,
  pendingVerificationsPrefix,
} from '../query-keys';

export function usePendingVerifications(page = 1, limit = 20) {
  return useQuery({
    queryKey: pendingVerificationsKey(page, limit),
    queryFn: () => adminApi.listPending({ page, limit }),
    staleTime: 1000 * 30,
  });
}

export function useDecideVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: DecideIdVerificationDto;
    }) => adminApi.decide(userId, payload),

    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: [...pendingVerificationsPrefix] });

      const previousEntries = queryClient.getQueriesData<ListPendingResponseDto>({
        queryKey: [...pendingVerificationsPrefix],
      });

      queryClient.setQueriesData<ListPendingResponseDto>(
        { queryKey: [...pendingVerificationsPrefix] },
        (old) => {
          if (!old) return old;
          const items = old.items.filter(
            (item: PendingVerificationSummary) => item.userId !== userId,
          );
          return {
            ...old,
            items,
            total: Math.max(0, old.total - 1),
          };
        },
      );

      return { previousEntries };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...pendingVerificationsPrefix] });
    },
  });
}
