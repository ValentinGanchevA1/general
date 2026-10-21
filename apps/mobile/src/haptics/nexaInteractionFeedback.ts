import { nexaHaptics, type NexaHapticIntent } from './nexaHaptics';

export type NexaMutationFeedbackIntent = Extract<
  NexaHapticIntent,
  'connect' | 'commit' | 'success'
>;

/**
 * Wrap a direct, user-initiated mutation so tactile feedback happens at the
 * truthful outcome boundary: success after the server accepts the mutation,
 * error only after the mutation actually fails.
 *
 * Keep background refreshes, socket reconciliation and passive reads outside
 * this helper. They must not impersonate a user-confirmed action.
 */
export async function withNexaMutationFeedback<T>(
  operation: () => Promise<T>,
  successIntent: NexaMutationFeedbackIntent = 'commit',
): Promise<T> {
  try {
    const value = await operation();
    nexaHaptics[successIntent]();
    return value;
  } catch (error: unknown) {
    nexaHaptics.error();
    throw error;
  }
}
