import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminContentReport, AdminContentReportPage, ContentReportDecision, ContentReportStatus } from '@g88/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PAGE_SIZE = 20;
const REPORTS_KEY = ['admin', 'content-reports'] as const;

 async function loadReports(status: ContentReportStatus, offset: number): Promise<AdminContentReportPage> {
  const { data } = await apiClient.get<AdminContentReportPage>('/admin/content-reports', {
    params: { status, offset, limit: PAGE_SIZE },
  });
  return data;
}

async function decideReport(report: AdminContentReport, decision: ContentReportDecision): Promise<void> {
  await apiClient.post(`/admin/content-reports/${report.id}/decide`, { decision });
}

export default function ContentReportsPage() {
  const [status, setStatus] = useState<ContentReportStatus>('open');
  const [offset, setOffset] = useState(0);
  const client = useQueryClient();
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: [...REPORTS_KEY, status, offset],
    queryFn: () => loadReports(status, offset),
  });
  const decision = useMutation({
    mutationFn: ({ report, action }: { report: AdminContentReport; action: ContentReportDecision }) =>
      decideReport(report, action),
    onSuccess: async () => {
      toast.success('Report updated');
      await client.invalidateQueries({ queryKey: [...REPORTS_KEY] });
    },
    onError: () => toast.error('Could not process report. Please retry.'),
  });
  const handleDecision = (report: AdminContentReport, action: ContentReportDecision) => {
    const explanation = action.startsWith('hide_')
      ? 'Hide this reported content from discovery/read surfaces?'
      : action === 'dismiss' ? 'Dismiss this report without hiding content?' : 'Mark this report reviewed without hiding content?';
    if (!window.confirm(explanation)) return;
    decision.mutate({ report, action });
  };

  const reports = data?.items ?? [];
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Safety reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review UGC safety reports. Never dismiss a report without assessing the content.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <label htmlFor="report-status" className="text-sm">Status</label>
            <select id="report-status" value={status} onChange={event => {
              setStatus(event.currentTarget.value as ContentReportStatus);
              setOffset(0);
            }} className="border rounded-lg px-3 py-1.5 bg-background">
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="dismissed">Dismissed</option>
              <option value="hidden">Hidden</option>
            </select>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>Refresh</Button>
          </div>
        </div>
        {isLoading ? <p role="status">Loading reports…</p> : null}
        {error ? <p role="alert" className="text-destructive">Unable to load reports. Check admin permissions and backend.</p> : null}
        {!isLoading && !error && reports.length === 0 ? <p>No {status} reports in this page.</p> : null}
        <div className="space-y-3">
          {reports.map(report => (
            <article key={report.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-sm items-center">
                <strong>{report.targetType.replace('_', ' ')}</strong>
                <span className="rounded bg-muted px-2 py-0.5">{report.reason}</span>
                <span className="text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-sm break-all">
                <p><strong>Subject:</strong> {report.targetDisplayName ?? '(deleted/unavailable)'} · {report.targetId}</p>
                <p><strong>Reporter ID:</strong> {report.reporterId}</p>
                <p><strong>Report ID:</strong> {report.id}</p>
              </div>
              {report.targetCaption ? (
                <p className="border-l-2 pl-3 whitespace-pre-wrap break-words text-sm">{report.targetCaption}</p>
              ) : null}
              {report.targetMediaUrl ? (
                <a className="underline text-sm" href={report.targetMediaUrl}
                  target="_blank" rel="noopener noreferrer">Inspect reported media (may be sensitive)</a>
              ) : null}
              {report.status === 'open' ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={decision.isPending}
                    onClick={() => handleDecision(report, 'review')}>Mark reviewed</Button>
                  <Button variant="outline" disabled={decision.isPending}
                    onClick={() => handleDecision(report, 'dismiss')}>Dismiss</Button>
                  {(['story', 'listing', 'event', 'check_in', 'alert', 'event_question'] as const).includes(
                    report.targetType as 'story' | 'listing' | 'event' | 'check_in' | 'alert' | 'event_question',
                  ) ? (
                    <Button variant="destructive" disabled={decision.isPending}
                      onClick={() => handleDecision(report,
                        ({ story: 'hide_story', listing: 'hide_listing', event: 'hide_event',
                           check_in: 'hide_check_in', alert: 'hide_alert', event_question: 'hide_event_question' } as const)[report.targetType as 'story' | 'listing' | 'event' | 'check_in'])}>
                      Hide {report.targetType.replace('_', ' ')}
                    </Button>
                  ) : null}
                </div>
              ) : <p className="text-muted-foreground text-xs">Status: {report.status} · {report.reviewedAt ?? 'pending'}</p>}
            </article>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <Button variant="outline" disabled={offset <= 0 || isFetching}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {Math.floor(offset / PAGE_SIZE) + 1}</span>
          <Button variant="outline" disabled={data?.nextOffset == null || isFetching}
            onClick={() => setOffset(data?.nextOffset ?? offset)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
