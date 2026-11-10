'use strict';

/**
 * Fail closed when a database already contains a migration filename unknown to
 * this checkout. A stale production branch must not silently proceed with SQL
 * migration writes after a draft/preview branch modified the same database.
 *
 * No writes occur in this function. Do not automatically delete/rename unknown
 * tracking rows: they may represent real production schema/data changes.
 */
async function assertMigrationHistoryCompatible(client, localFiles, legacyAliases = []) {
  const tracker = await client.query(
    "SELECT to_regclass('public.schema_migrations') AS tracker_table",
  );
  const trackerExists = tracker.rows[0]?.tracker_table != null;
  // A missing/empty tracker is safe only if no established app schema exists.
  // Never infer that all migration files were applied solely from users existing.
  if (!trackerExists) {
    const users = await client.query(
      "SELECT to_regclass('public.users') AS users_table",
    );
    if (users.rows[0]?.users_table != null) {
      const error = new Error(
        'MIGRATION_HISTORY_UNTRACKED: users exists but schema_migrations is missing. ' +
        'Refusing all migration writes. Investigate the historical schema before baseline.',
      );
      error.code = 'MIGRATION_HISTORY_UNTRACKED';
      throw error;
    }
    return;
  }

  const { rows } = await client.query(
    'SELECT filename FROM public.schema_migrations ORDER BY filename',
  );
  if (rows.length === 0) {
    const users = await client.query(
      "SELECT to_regclass('public.users') AS users_table",
    );
    if (users.rows[0]?.users_table != null) {
      const error = new Error(
        'MIGRATION_HISTORY_UNTRACKED: users exists but schema_migrations is empty. ' +
        'Refusing all migration writes. Restore/reconcile tracker on isolated staging.',
      );
      error.code = 'MIGRATION_HISTORY_UNTRACKED';
      throw error;
    }
  }
  const known = new Set([...localFiles, ...legacyAliases]);
  const unknown = rows
    .map((row) => row.filename)
    .filter((filename) => typeof filename !== 'string' || !known.has(filename));

  if (unknown.length > 0) {
    // Filenames may contain untrusted bytes; never echo raw DB content to logs.
    const sample = unknown.slice(0, 5).map((name) =>
      String(name).slice(0, 90).replace(/[^a-zA-Z0-9_.-]/g, '?'),
    ).join(', ');
    const error = new Error(
      `MIGRATION_HISTORY_DRIFT: ${unknown.length} applied migration filename(s) ` +
      `are absent from this checkout (${sample}). Refusing all migration writes. ` +
      'Do not delete schema_migrations rows or replay SQL. Reconcile the actual ' +
      'database history and branch migration files in an isolated environment first.',
    );
    error.code = 'MIGRATION_HISTORY_DRIFT';
    throw error;
  }
}

module.exports = { assertMigrationHistoryCompatible };
