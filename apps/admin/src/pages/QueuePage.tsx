// apps/admin/src/pages/QueuePage.tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VerificationTable } from '@/features/verification/components/VerificationTable';
import { usePendingVerifications } from '@/features/verification/hooks/usePendingVerifications';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useVerificationSocket } from '@/features/verification/hooks/useVerificationSocket';

export default function QueuePage() {
  const queryClient = useQueryClient();
  const { isConnected } = useVerificationSocket();
  const { data } = usePendingVerifications();
  const total = data?.total ?? 0;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ['verifications', 'pending'],
      });
      toast.success('Queue refreshed');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                ID Verification Queue
              </h1>
              {total > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 text-xs font-semibold px-2.5 py-0.5 border border-amber-200">
                  {total} pending
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Compare selfie to ID, then approve or reject. Face match is assist-only.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-2 border ${
                isConnected
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
              title={isConnected ? 'Realtime updates connected' : 'Realtime reconnecting'}
            >
              {isConnected ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              {isConnected ? 'Live' : 'Offline'}
            </div>

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
          </div>
        </div>

        <VerificationTable />
      </div>
    </div>
  );
}
