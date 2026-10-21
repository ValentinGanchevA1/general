import type { ViewStyle } from 'react-native';

/**
 * Shared PROTOS NEXUS visual primitives.
 * Presentation only: premium authorization remains server-authoritative.
 */
export const nexusVisual = {
  radius: {
    card: 22,
    control: 16,
    pill: 999,
  },
  borderWidth: 1,
  glow: {
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  } satisfies Pick<ViewStyle, 'shadowOpacity' | 'shadowRadius' | 'elevation'>,
} as const;

export type NexusVisualTokens = typeof nexusVisual;
