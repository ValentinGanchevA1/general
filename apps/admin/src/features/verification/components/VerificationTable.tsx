import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AdminVerificationDetailDto, PendingVerificationSummary } from '@g88/shared';
import { usePendingVerifications } from '../hooks/usePendingVerifications';
import { adminApi } from '../api';
import { VerificationDetailModal } from './VerificationDetailModal';

interface VerificationTableProps {
	onRowClick?: (summary: PendingVerificationSummary) => void;
}

export function VerificationTable({ onRowClick }: VerificationTableProps) {
	const [selectedVerification, setSelectedVerification] = useState<AdminVerificationDetailDto | null>(null);
	const [modalOpen, setModalOpen] = useState(false);

	const queryClient = useQueryClient();
	const { data, isLoading, isError } = usePendingVerifications();
	const rows: PendingVerificationSummary[] = data?.items ?? [];

	const openDetail = async (summary: PendingVerificationSummary) => {
		try {
			const detail = await adminApi.getDetail(summary.userId);
			setSelectedVerification(detail);
			setModalOpen(true);
			onRowClick?.(summary);
		} catch (err) {
			toast.error('Failed to load verification details');
		}
	};

	if (isLoading) return <div className="p-6 text-sm text-slate-400">Loading pending verifications…</div>;
	if (isError) return <div className="p-6 text-sm text-red-400">Failed to load verification queue.</div>;
	if (rows.length === 0) return <div className="p-6 text-sm text-slate-400">No pending verifications.</div>;

	return (
		<>
			<table className="w-full text-left text-sm">
				<thead>
				<tr className="border-b border-slate-700 text-slate-400">
					<th className="py-2 pr-4 font-medium">User</th>
					<th className="py-2 pr-4 font-medium">Submitted</th>
					<th className="py-2 pr-4 font-medium" />
				</tr>
				</thead>
				<tbody>
				{rows.map((summary) => (
					<tr
						key={summary.id}
						className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/50"
						onClick={() => openDetail(summary)}
					>
						<td className="py-2 pr-4">{summary.userId}</td>
						<td className="py-2 pr-4">{new Date(summary.submittedAt).toLocaleString()}</td>
						<td className="py-2 pr-4 text-right">
							<button
								type="button"
								className="text-cyan-400 hover:underline"
								onClick={(e) => {
									e.stopPropagation();
									openDetail(summary);
								}}
							>
								Review
							</button>
						</td>
					</tr>
				))}
				</tbody>
			</table>

			<VerificationDetailModal
				verification={selectedVerification}
				open={modalOpen}
				onOpenChange={setModalOpen}
				onDecisionMade={() => queryClient.invalidateQueries({ queryKey: ['verifications', 'pending'] })}
			/>
		</>
	);
}
