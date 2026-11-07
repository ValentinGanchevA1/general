/** User-generated-content abuse reports. Never include free-text/media or exact GPS in the submission. */
export const CONTENT_REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'privacy', 'other'] as const;
export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number];
export type ContentReportTarget = 'user' | 'story';
export interface CreateContentReportRequest {
  targetType: ContentReportTarget;
  targetId: string;
  reason: ContentReportReason;
}
export interface CreateContentReportResponse { reported: true }
export type ContentReportStatus = 'open' | 'reviewed' | 'dismissed' | 'hidden';
export interface ContentReport {
  id: string;
  reporterId: string;
  targetType: ContentReportTarget;
  targetId: string;
  reason: ContentReportReason;
  status: ContentReportStatus;
  createdAt: string;
  reviewedAt: string | null;
}
export interface ContentReportPage { items: ContentReport[]; nextOffset: number | null }
export type ContentReportDecision = 'review' | 'dismiss' | 'hide_story';
