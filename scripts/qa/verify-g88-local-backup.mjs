import { createHash } from 'node:crypto';
import { createReadStream, existsSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = Object.freeze(['roles.sql', 'schema.sql', 'data.sql']);
const EVIDENCE_NAME = 'NEXUS_PRIVATE_BACKUP_EVIDENCE.json';

function within(parent, child) {
  const relativePath = relative(parent, child);
  return relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith('..' + sep) &&
      !isAbsolute(relativePath));
}

export function safePrivateDirectory(directory, repositoryRoot = ROOT) {
  const resolved = realpathSync(directory);
  const repository = realpathSync(repositoryRoot);
  const privateRoot = resolve(repository, '.private');
  // A relative path or a symlink must never allow writing backup evidence into
  // a tracked repository path. External encrypted volumes are also allowed.
  if (within(repository, resolved) && !within(privateRoot, resolved)) {
    throw new Error('Backup location is inside a potentially tracked repository directory');
  }
  return resolved;
}

export async function inspectBackupDirectory(directory, repositoryRoot = ROOT) {
  const safeDirectory = safePrivateDirectory(directory, repositoryRoot);
  const verified = [];
  for (const filename of FILES) {
    const file = realpathSync(join(safeDirectory, filename));
    if (!within(safeDirectory, file)) {
      throw new Error('Backup file path escapes the selected directory');
    }
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error('Backup entry is not a regular file');
    if (stat.size === 0 && filename !== 'roles.sql') {
      throw new Error('Required schema/data dump is empty');
    }
    const hash = createHash('sha256');
    for await (const buffer of createReadStream(file)) hash.update(buffer);
    verified.push({ filename: basename(file), bytes: stat.size, sha256: hash.digest('hex') });
  }
  return {
    evidenceVersion: 1,
    evidenceType: 'FILE_INTEGRITY_ONLY',
    files: verified,
    sourceDatabaseAttested: false,
    restoreTestPassed: false,
    productionDeploymentApproved: false,
    releaseDisposition: 'NO_GO_PENDING_ISOLATED_RESTORE',
  };
}

export function writePrivateEvidence(directory, evidence, repositoryRoot = ROOT) {
  const safeDirectory = safePrivateDirectory(directory, repositoryRoot);
  const target = join(safeDirectory, EVIDENCE_NAME);
  if (existsSync(target)) throw new Error('Evidence file exists: use a new backup directory');
  writeFileSync(target, JSON.stringify(evidence, null, 2) + '\n', {
    encoding: 'utf8', mode: 0o600, flag: 'wx',
  });
  return EVIDENCE_NAME;
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length < 1 || args.length > 2 ||
        (args.length === 2 && args[1] !== '--write-evidence')) {
      throw new Error('Invalid arguments');
    }
    const evidence = await inspectBackupDirectory(args[0]);
    if (args[1] === '--write-evidence') {
      writePrivateEvidence(args[0], evidence);
    }
    process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');
  } catch {
    // Do not echo absolute backup paths, SQL, credentials or driver errors.
    process.stderr.write(
      'Backup evidence unavailable: use a private directory with roles.sql, schema.sql and data.sql.\n',
    );
  } finally {
    // Deliberately never green-lights a deployment: a checksum is NOT a restore.
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
