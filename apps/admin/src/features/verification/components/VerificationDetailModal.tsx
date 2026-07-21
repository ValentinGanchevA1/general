// apps/admin/src/features/verification/components/VerificationDetailModal.tsx
import React from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';

import {
	AdminVerificationDetailDto
} from '@g88/shared';

import { adminApi } from '../api';

interface VerificationDetailModalProps {
	verification: AdminVerificationDetailDto | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDecisionMade?: () => void;
}

export function VerificationDetailModal({
											verification,
											open,
											onOpenChange,
											onDecisionMade,
										}: VerificationDetailModalProps) {
	const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null);
	const [reason, setReason] = React.useState('');
	const [isSubmitting, setIsSubmitting] = React.useState(false);

	const resetForm = () => {
		setDecision(null);
		setReason('');
	};

	const handleClose = () => {
		resetForm();
		onOpenChange(false);
	};

	const handleSubmit = async () => {
		if (!verification || !decision) return;

		setIsSubmitting(true);
		try {
			await adminApi.decide(verification.userId, {
				status: decision,
				reason: reason.trim() || undefined,
			});

			toast.success(
				`Verification ${decision === 'approve' ? 'approved' : 'rejected'} successfully`
			);

			onDecisionMade?.();
			handleClose();
		} catch (error) {
			toast.error('Failed to process decision');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!verification) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-3">
						ID Verification Review
						<Badge variant="outline">User ID: {verification.userId}</Badge>
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex gap-6">
					{/* Images Section */}
					<div className="flex-1 flex flex-col gap-4">
						<div>
							<Label className="text-sm font-medium mb-2 block">Selfie</Label>
							<div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
								<img
									src={verification.selfieUrl}
									alt="Selfie"
									className="w-full h-full object-contain bg-black"
									onError={(e) => {
										e.currentTarget.src = '/placeholder-selfie.png'; // fallback
									}}
								/>
							</div>
						</div>

						<div>
							<Label className="text-sm font-medium mb-2 block">ID Front</Label>
							<div className="aspect-video bg-muted rounded-lg overflow-hidden border">
								<img
									src={verification.idFrontUrl}
									alt="ID Front"
									className="w-full h-full object-contain bg-black"
									onError={(e) => {
										e.currentTarget.src = '/placeholder-id.png';
									}}
								/>
							</div>
						</div>

						{verification.idBackUrl && (
							<div>
								<Label className="text-sm font-medium mb-2 block">ID Back</Label>
								<div className="aspect-video bg-muted rounded-lg overflow-hidden border">
									<img
										src={verification.idBackUrl}
										alt="ID Back"
										className="w-full h-full object-contain bg-black"
										onError={(e) => {
											e.currentTarget.src = '/placeholder-id.png';
										}}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Info & Decision Panel */}
					<div className="w-96 flex flex-col">
						<ScrollArea className="flex-1 pr-4">
							<div className="space-y-6">
								<div>
									<div className="flex items-center gap-2 mb-1">
										<User className="w-4 h-4" />
										<span className="font-medium">{verification.displayName}</span>
									</div>
									<div className="text-sm text-muted-foreground flex items-center gap-1">
										<Clock className="w-4 h-4" />
										Submitted {new Date(verification.submittedAt).toLocaleString()}
									</div>
								</div>

								<Separator />

								{/* Decision Section */}
								<div className="space-y-4">
									<Label className="text-base font-semibold">Decision</Label>

									<div className="grid grid-cols-2 gap-3">
										<Button
											variant={decision === 'approve' ? 'default' : 'outline'}
											className={`h-20 flex flex-col items-center justify-center gap-1 ${decision === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}`}
											onClick={() => setDecision('approve')}
										>
											<CheckCircle className="w-6 h-6" />
											<span>Approve</span>
										</Button>

										<Button
											variant={decision === 'reject' ? 'destructive' : 'outline'}
											className={`h-20 flex flex-col items-center justify-center gap-1`}
											onClick={() => setDecision('reject')}
										>
											<XCircle className="w-6 h-6" />
											<span>Reject</span>
										</Button>
									</div>

									{decision === 'reject' && (
										<div>
											<Label htmlFor="reason">Rejection Reason (optional)</Label>
											<Textarea
												id="reason"
												placeholder="e.g. Blurry photo, mismatched details, suspicious document..."
												value={reason}
												onChange={(e) => setReason(e.target.value)}
												className="mt-1"
												rows={4}
											/>
										</div>
									)}
								</div>
							</div>
						</ScrollArea>

						<DialogFooter className="mt-6 pt-4 border-t">
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={!decision || isSubmitting}
								className={decision === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
							>
								{isSubmitting
									? 'Processing...'
									: decision === 'approve'
										? 'Approve Verification'
										: 'Reject Verification'
								}
							</Button>
						</DialogFooter>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
