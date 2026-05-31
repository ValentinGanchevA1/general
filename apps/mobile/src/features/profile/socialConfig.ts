import type { SocialProvider, SubscriptionTier } from '@g88/shared';

/** MaterialCommunityIcons name + brand colour per social provider. */
export const SOCIAL_PROVIDER_CONFIG: Record<
  SocialProvider,
  { label: string; icon: string; color: string }
> = {
  instagram: { label: 'Instagram', icon: 'instagram', color: '#E4405F' },
  twitter: { label: 'X', icon: 'twitter', color: '#1DA1F2' },
  tiktok: { label: 'TikTok', icon: 'music-note', color: '#000000' },
  facebook: { label: 'Facebook', icon: 'facebook', color: '#1877F2' },
  linkedin: { label: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },
  spotify: { label: 'Spotify', icon: 'spotify', color: '#1DB954' },
};

export const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: 'Free',
  basic: 'Basic',
  premium: 'Premium',
};

export const TIER_COLOR: Record<SubscriptionTier, string> = {
  free: '#666',
  basic: '#00d4ff',
  premium: '#9C27B0',
};
