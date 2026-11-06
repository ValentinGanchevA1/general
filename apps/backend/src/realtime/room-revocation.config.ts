/**
 * Explicit two-phase rollout guard. Existing master may auto-deploy on Render
 * before migration 0069 is applied. Never query the outbox until the owner
 * enables this flag after verifying the production schema.
 */
export function roomRevocationOutboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ROOM_REVOCATION_OUTBOX_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('ROOM_REVOCATION_OUTBOX_ENABLED must be true or false');
}
