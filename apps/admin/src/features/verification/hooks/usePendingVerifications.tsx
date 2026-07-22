import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api';
import type { PendingVerificationSummary, DecideIdVerificationDto, AdminVerificationDetailDto } from '@g88/shared';

export function usePendingVerifications(page = 1, limit = 20) {
	return useQuery({
		queryKey: ['verifications', 'pending', page, limit],
		queryFn: () => adminApi.listPending({ page, limit }),
		staleTime: 1000 * 30,
	});
}

export function useDecideVerification() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: DecideIdVerificationDto }) =>
			adminApi.decide(id, payload),
		onMutate: async ({ id, payload }) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({ queryKey: ['verifications', 'pending'] });

			const previousData = queryClient.getQueryData(['verifications', 'pending']);

			// Optimistic update: remove from pending list
			queryClient.setQueryData(['verifications', 'pending'], (old: any) => ({
				...old,
				items: old?.items.filter((item: PendingVerificationSummary) => item.id !== id) || [],
			}));

			return { previousData };
		},
		onError: (err, variables, context) => {
			// Rollback
			if (context?.previousData) {
				queryClient.setQueryData(['verifications', 'pending'], context.previousData);
			}
			// Toast handled in component
		},
		onSettled: () => {
			// Always refetch to sync (handles server changes)
			queryClient.invalidateQueries({ queryKey: ['verifications', 'pending'] });
		},
	});
}
