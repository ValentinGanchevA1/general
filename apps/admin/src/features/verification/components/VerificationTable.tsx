import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AdminVerificationDetailDto,
  PendingVerificationSummary,
} from '@g88/shared';
import { usePendingVerifications } from '../hooks/usePendingVerifications';
import { adminApi } from '../api';
import { pendingVerificationsPrefix } from '../query-keys';
import { VerificationDetailModal } from './VerificationDetailModal';
import { ClipboardCopy, Inbox, Loader2 } from 'lucide-react';

function relativeWait(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m waiting`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function VerificationTable() {
  const [selectedVerification, setSelectedVerification] =
    useState<AdminVerificationDetailDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading, isError, isFetching } = usePendingVerifications();
  const rows: PendingVerificationSummary[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const openDetail = async (summary: PendingVerificationSummary) => {
    setLoadingUserId(summary.userId);
    try {
      const detail = await adminApi.getDetail(summary.userId);
      setSelectedVerification(detail);
      setModalOpen(true);
    } catch {
      toast.error('Failed to load verification details');
    } finally {
      setLoadingUserId(null);
    }
  };

  const copyId = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      toast.success('User ID copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading pending verifications…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Failed to load the verification queue. Check your session and try Refresh.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 flex flex-col items-center gap-3 text-center">
        <Inbox className="w-10 h-10 text-muted-foreground/60" />
        <div>
          <p className="font-medium">Queue is clear</p>
          <p className="text-sm text-muted-foreground mt-1">
            New ID submissions will appear here automatically when Live is connected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {rows.length}
            {total > rows.length ? ` of ${total}` : ''} · oldest first
          </span>
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Updating
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 px-4 font-medium">User</th>
                <th className="py-3 px-4 font-medium">Submitted</th>
                <th className="py-3 px-4 font-medium">Wait</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((summary) => {
                const busy = loadingUserId === summary.userId;
                return (
                  <tr
                    key={summary.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openDetail(summary)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(summary);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Review verification for ${summary.userId}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs sm:text-sm">
                          {shortId(summary.userId)}
                        </code>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Copy full user id"
                          onClick={(e) => copyId(e, summary.userId)}
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(summary.submittedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium tabular-nums text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-0.5">
                        {relativeWait(summary.submittedAt)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        className="text-sm font-medium text-cyan-700 hover:text-cyan-900 hover:underline disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(summary);
                        }}
                      >
                        {busy ? 'Loading…' : 'Review'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <VerificationDetailModal
        verification={selectedVerification}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onDecisionMade={() =>
          queryClient.invalidateQueries({
            queryKey: [...pendingVerificationsPrefix],
          })
        }
      />
    </>
  );
}
