const [selectedVerification, setSelectedVerification] = useState<AdminVerificationDetailDto | null>(null);
const [modalOpen, setModalOpen] = useState(false);

interface VerificationTableProps {
	onRowClick?: (summary: PendingVerificationSummaryDto) => void;
}

// In openDetail function:
const openDetail = async (summary: PendingVerificationSummaryDto) => {
	try {
		const detail = await adminApi.getDetail(summary.userId);
		setSelectedVerification(detail);
		setModalOpen(true);
	} catch (err) {
		toast.error("Failed to load verification details");
	}
};

// At the bottom of the component:
<VerificationDetailModal
	verification={selectedVerification}
	open={modalOpen}
	onOpenChange={setModalOpen}
	onDecisionMade={() => {
		// Refresh list
		queryClient.invalidateQueries({ queryKey: ['verifications', 'pending'] });
	}}
/>
