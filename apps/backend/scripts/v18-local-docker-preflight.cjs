'use strict';

// Inspect ONLY local Docker metadata. No database connection, credential lookup,
// migration, role change, container start, or deployment.
const { execFileSync } = require('node:child_process');

const CONTAINER_PATTERN = /^supabase_db_[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const DATABASE_PORT = '54322';
const INSPECTION_FORMATS = Object.freeze({
  running: '{{json .State.Running}}',
  image: '{{json .Config.Image}}',
  ports: '{{json .NetworkSettings.Ports}}',
});

function assess(container, running, image, ports) {
  const issues = [];
  if (typeof container !== 'string' || !CONTAINER_PATTERN.test(container)) {
    issues.push('LOCAL_SUPABASE_DB_CONTAINER_NAME_UNVERIFIED');
  }
  if (running !== true) issues.push('LOCAL_DB_CONTAINER_NOT_RUNNING');
  if (typeof image !== 'string' || !/(?:^|\/)supabase\/postgres:[a-zA-Z0-9_.-]+$/.test(image)) {
    issues.push('LOCAL_SUPABASE_POSTGRES_IMAGE_UNVERIFIED');
  }

  const entries = ports && typeof ports === 'object' && !Array.isArray(ports)
    ? Object.entries(ports) : [];
  const bindings = entries.find(([port]) => port === '5432/tcp')?.[1];
  if (!Array.isArray(bindings) || bindings.length !== 1 ||
      bindings[0]?.HostIp !== '127.0.0.1' ||
      bindings[0]?.HostPort !== DATABASE_PORT) {
    issues.push('LOCAL_POSTGRES_NOT_EXCLUSIVELY_LOOPBACK_54322');
  }
  // Ensure no additional TCP/UDP ports from this DB container are published.
  if (entries.some(([port, value]) => port !== '5432/tcp' &&
      value !== null && (!Array.isArray(value) || value.length > 0))) {
    issues.push('OTHER_DB_CONTAINER_PORTS_EXPOSED');
  }

  return {
    mode: 'LOCAL_DOCKER_METADATA_ONLY',
    containerName: CONTAINER_PATTERN.test(container || '') ? container : '(not accepted)',
    expectedHost: '127.0.0.1',
    expectedPublishedPort: Number(DATABASE_PORT),
    metadataMatchesExpectedShape: issues.length === 0,
    productionTargetExclusionProven: false,
    networkAndSideEffectIsolationProven: false,
    stagingRuntimeRoleTested: false,
    stagingConnectionOrRestoreAuthorized: false,
    productionReleaseDecision: 'NO-GO',
    issues: [
      ...issues,
      'DATABASE_IDENTITY_NOT_ATTESTED_BY_CONNECTION',
      'STAGING_EXTERNAL_SIDE_EFFECTS_NOT_ATTESTED',
      'RESTRICTED_ROLE_AND_INTEGRATION_TESTS_NOT_DONE',
      'MIGRATION_HISTORY_DRIFT_UNRESOLVED',
    ],
  };
}

function inspectDocker(container, runner = execFileSync) {
  if (!CONTAINER_PATTERN.test(container || '')) {
    throw new Error('Invalid local container name (redacted)');
  }
  function read(format) {
    // Strictly selected scalar metadata fields; NEVER Docker inspect .Config.Env
    // or full container JSON. No shell and no user-defined format strings.
    const output = runner('docker', ['inspect', '--type=container', '--format', format, container], {
      encoding: 'utf8', timeout: 5000, maxBuffer: 8192, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(String(output).trim());
  }
  return assess(container,
    read(INSPECTION_FORMATS.running),
    read(INSPECTION_FORMATS.image),
    read(INSPECTION_FORMATS.ports));
}

function main() {
  // Deliberately no implicit scan of local containers.
  const args = process.argv.slice(2);
  try {
    if (args.length !== 2 || args[0] !== '--container') {
      throw new Error('Invalid arguments');
    }
    process.stdout.write(JSON.stringify(inspectDocker(args[1]), null, 2) + '\n');
  } catch {
    // Docker errors may contain environment or untrusted metadata: never print.
    process.stderr.write('Local Docker metadata preflight unavailable (details redacted). NO-GO.\n');
  }
  process.exitCode = 2; // diagnostic only, even if metadata checks pass
}

if (require.main === module) main();
module.exports = { assess, inspectDocker, INSPECTION_FORMATS };
