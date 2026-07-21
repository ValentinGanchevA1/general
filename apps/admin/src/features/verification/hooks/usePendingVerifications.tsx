// apps/admin/src/features/verification/hooks/usePendingVerifications.ts
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api';

export function usePendingVerifications(page = 1, limit = 20) {
	return useQuery({
		queryKey: ['verifications', 'pending', page, limit],
		queryFn: () => adminApi.listPending({ page, limit }),
		staleTime: 1000 * 30, // 30 seconds
	});
}
