import {cpSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CLI_VERSION = '20.2.0';
const REACT_NATIVE_VERSION = '0.83.0';
const APP_NAME = 'G88';
const APP_TITLE = 'NEXA';
const BUNDLE_ID = 'com.g88';

if (process.platform !== 'darwin') {
  throw new Error('[ios-bootstrap] iOS native bootstrap requires macOS.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const iosRoot = path.join(mobileRoot, 'ios');
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'nexa-ios-bootstrap-'));
const generatedRoot = path.join(tempRoot, APP_NAME);

try {
  console.log(
    `[ios-bootstrap] generating ${APP_NAME} from React Native ${REACT_NATIVE_VERSION} with CLI ${CLI_VERSION}`,
  );

  const result = spawnSync(
    'npx',
    [
      '--yes',
      `@react-native-community/cli@${CLI_VERSION}`,
      'init',
      APP_NAME,
      '--version',
      REACT_NATIVE_VERSION,
      '--directory',
      generatedRoot,
      '--title',
      APP_TITLE,
      '--package-name',
      BUNDLE_ID,
      '--skip-install',
      '--install-pods',
      'false',
      '--skip-git-init',
    ],
    {stdio: 'inherit'},
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`[ios-bootstrap] React Native init failed with status ${result.status ?? 'unknown'}.`);
  }

  const generatedIosRoot = path.join(generatedRoot, 'ios');
  const sources = [
    [path.join(generatedIosRoot, APP_NAME), path.join(iosRoot, APP_NAME)],
    [
      path.join(generatedIosRoot, `${APP_NAME}.xcodeproj`),
      path.join(iosRoot, `${APP_NAME}.xcodeproj`),
    ],
  ];

  for (const [source, destination] of sources) {
    if (!existsSync(source)) {
      throw new Error(`[ios-bootstrap] expected generated path is missing: ${source}`);
    }
    rmSync(destination, {recursive: true, force: true});
    cpSync(source, destination, {recursive: true});
  }

  console.log(`[ios-bootstrap] native iOS shell ready at ${iosRoot}`);
} finally {
  rmSync(tempRoot, {recursive: true, force: true});
}
