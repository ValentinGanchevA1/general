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
  if (tracker.rows[0]?.tracker_table == null) {
    // A fresh database can continue through the existing bootstrap flow.
    return;
  }

  const { rows } = await client.query(
    'SELECT filename FROM public.schema_migrations ORDER BY filename',
  );
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
