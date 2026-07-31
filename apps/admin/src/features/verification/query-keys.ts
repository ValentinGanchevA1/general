export const pendingVerificationsPrefix = ['verifications', 'pending'] as const;

export function pendingVerificationsKey(page = 1, limit = 20) {
  return [...pendingVerificationsPrefix, page, limit] as const;
}
