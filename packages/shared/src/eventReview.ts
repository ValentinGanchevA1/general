/** Post-event feedback never changes identity verification or trust. */
export const EVENT_REVIEW_TAGS = ['welcoming', 'well_organized', 'great_venue', 'good_value', 'could_improve'] as const;
export type EventReviewTag = (typeof EVENT_REVIEW_TAGS)[number];
export const EVENT_REVIEW_LIMITS = { tagsMax: 3, commentMax: 500, editHours: 24, pageMax: 50 } as const;
export const EVENT_REVIEW_TAG_LABELS: Record<EventReviewTag, string> = {
  welcoming: 'Welcoming', well_organized: 'Well organized', great_venue: 'Great venue',
  good_value: 'Good value', could_improve: 'Could improve',
};
export interface SaveEventReviewRequest { rating: number; tags: EventReviewTag[]; comment: string }
export interface EventReview extends SaveEventReviewRequest {
  id: string; eventId: string; userId: string; displayName: string;
  createdAt: string; updatedAt: string; editableUntil: string;
}
export type EventReviewEligibility = 'eligible' | 'event_ongoing' | 'attendance_unconfirmed' | 'own_event' | 'moderated';
export interface MyEventReview {
  eligibility: EventReviewEligibility; myReview: EventReview | null; serverNow: string;
}
export interface EventReviewPage {
  items: EventReview[]; nextCursor: string | null; count: number; average: number | null;
}
export interface EventAttendance {
  userId: string; displayName: string; confirmedAt: string | null;
}
export interface EventAttendancePage { items: EventAttendance[]; nextCursor: string | null }
export const EVENT_REVIEW_REPORT_REASONS = ['abuse', 'spam', 'privacy', 'attendance_dispute'] as const;
export type EventReviewReportReason = (typeof EVENT_REVIEW_REPORT_REASONS)[number];
export interface EventReviewReport {
  id: string; eventId: string; reviewId: string; reason: EventReviewReportReason; createdAt: string;
}
