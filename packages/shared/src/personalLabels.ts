/** Self-described personality, never a verified identity or trust signal. */
export const PERSONAL_LABEL_CATEGORIES = [
  'character', 'social_style', 'vibe', 'humor', 'rhythm', 'values',
] as const;
export type PersonalLabelCategory = (typeof PERSONAL_LABEL_CATEGORIES)[number];
export type PersonalLabelLocale = 'bg' | 'en';
export const PERSONAL_LABEL_MAX_SELECTED = 5;

export interface PersonalLabel {
  key: string;
  label: string;
  emoji: string | null;
  category: PersonalLabelCategory;
}
export interface PersonalLabelCatalogResponse {
  items: PersonalLabel[];
  maxSelected: number;
}
export interface SelectedPersonalLabelsResponse {
  items: PersonalLabel[];
}
export interface SetPersonalLabelsRequest {
  keys: string[];
}
export interface PersonalLabelsFeaturePolicy {
  enabled: boolean;
}
export interface ProposePersonalLabelRequest {
  text: string;
  locale: PersonalLabelLocale;
}
export type PersonalLabelProposalStatus = 'pending' | 'approved' | 'rejected' | 'merged';
export interface PersonalLabelProposal {
  id: string;
  text: string;
  locale: PersonalLabelLocale;
  status: PersonalLabelProposalStatus;
  createdAt: string;
  reviewedAt: string | null;
}
export interface PersonalLabelProposalPage {
  items: PersonalLabelProposal[];
  nextOffset: number | null;
}
export interface AdminPersonalLabelProposal extends PersonalLabelProposal {
  userId: string;
  reviewerId: string | null;
  reviewNote: string | null;
}
export interface AdminPersonalLabelProposalPage {
  items: AdminPersonalLabelProposal[];
  nextOffset: number | null;
}
export type PersonalLabelReviewRequest =
  | { decision: 'approve'; key: string; labelBg: string; labelEn: string; category: PersonalLabelCategory; emoji?: string }
  | { decision: 'merge'; existingKey: string; note?: string }
  | { decision: 'reject'; note?: string };
