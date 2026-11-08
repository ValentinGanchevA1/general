/** User-generated-content abuse reports. Never include free-text/media or exact GPS in the submission. */
export const CONTENT_REPORT_REASONS = ['child_safety', 'spam', 'harassment', 'hate', 'sexual', 'violence', 'privacy', 'other'] as const;
export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number];
export type ContentReportTarget = 'user' | 'story' | 'listing' | 'event' | 'message' | 'check_in' | 'alert' | 'event_question';
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
export interface AdminContentReport extends ContentReport {
  targetDisplayName: string | null;
  targetCaption: string | null;
  targetMediaUrl: string | null;
}
export interface AdminContentReportPage { items: AdminContentReport[]; nextOffset: number | null }
export type ContentReportDecision = 'review' | 'dismiss' | 'hide_story' | 'hide_listing' | 'hide_event' | 'hide_check_in' | 'hide_alert' | 'hide_event_question';
