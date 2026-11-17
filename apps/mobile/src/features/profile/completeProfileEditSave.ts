/**
 * Edit Profile writes two independent resources.
 * Callers navigate away only after each requested write has succeeded.
 */
export async function completeProfileEditSave(
  profileSaved: boolean,
  savePendingLabels: (() => Promise<boolean>) | null,
): Promise<boolean> {
  if (!profileSaved) return false;
  return savePendingLabels ? savePendingLabels() : true;
}
