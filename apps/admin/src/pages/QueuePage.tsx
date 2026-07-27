// apps/admin/src/pages/QueuePage.tsx
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VerificationTable } from '@/features/verification/components/VerificationTable';
import { VerificationDetailModal } from '@/features/verification/components/VerificationDetailModal';
import {
  AdminVerificationDetailDto,
  PendingVerificationSummary,
} from '@g88/shared';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useVerificationSocket } from '@/features/verification/hooks/useVerificationSocket';
import { adminApi } from '@/features/verification/api';

export default function QueuePage() {
  const queryClient = useQueryClient();

  const { isConnected } = useVerificationSocket(); // Mounts listener
  const [selectedVerification, setSelectedVerification] =
    useState<AdminVerificationDetailDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh the entire queue
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ['verifications', 'pending'],
      });
      toast.success('Queue refreshed');
    } catch (err) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const openDetail = async (summary: PendingVerificationSummary) => {
    try {
      const detail = await adminApi.getDetail(summary.userId);
      setSelectedVerification(detail);
      setModalOpen(true);
    } catch (error) {
      toast.error('Could not load verification details');
    }
  };

  const handleDecisionMade = () => {
    queryClient.invalidateQueries({ queryKey: ['verifications', 'pending'] });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              ID Verification Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and approve user identity documents
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>

            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>

            <div
              className={`text-sm px-3 py-1 rounded flex items-center gap-2 ${
                isConnected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {isConnected ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              {isConnected ? 'Live' : 'Connecting...'}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <VerificationTable onRowClick={openDetail} />

        {/* Detail Modal */}
        <VerificationDetailModal
          verification={selectedVerification}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onDecisionMade={handleDecisionMade}
        />
      </div>
    </div>
  );
}
