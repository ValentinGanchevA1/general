import type { ContentReportTarget, CreateContentReportRequest, ContentReportReason } from '@g88/shared';
import type { AppDispatch } from '@/store';
import { appAlert } from '@/ui/appAlert';
import { submitContentReport } from './reportsSlice';

const OPTIONS: ReadonlyArray<{ reason: ContentReportReason; label: string }> = [
  { reason: 'harassment', label: 'Harassment or bullying' },
  { reason: 'spam', label: 'Spam or scam' },
  { reason: 'hate', label: 'Hate or discrimination' },
  { reason: 'sexual', label: 'Sexual content' },
  { reason: 'violence', label: 'Violence or threats' },
  { reason: 'privacy', label: 'Privacy concern' },
  { reason: 'other', label: 'Other' },
];

/** Show confirmation only after the API has persisted the report. */
export function showContentReportPrompt(
  dispatch: AppDispatch,
  targetType: ContentReportTarget,
  targetId: string,
): void {
  const send = async (reason: ContentReportReason): Promise<void> => {
    const body: CreateContentReportRequest = { targetType, targetId, reason };
    const result = await dispatch(submitContentReport(body));
    if (submitContentReport.fulfilled.match(result)) {
      appAlert('Report sent', 'Thank you. Your report has been received for review.');
    } else {
      appAlert('Report not sent', result.payload ?? 'Please try again.');
    }
  };
  appAlert('Report ' + (targetType === 'story' ? 'story' : 'profile'), 'Choose a reason:', [
    ...OPTIONS.map(option => ({
      text: option.label,
      onPress: () => { void send(option.reason); },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
