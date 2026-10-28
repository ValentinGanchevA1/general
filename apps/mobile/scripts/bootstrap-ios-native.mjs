import {cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CLI_VERSION = '20.2.0';
const REACT_NATIVE_VERSION = '0.83.0';
const APP_NAME = 'G88';
const APP_TITLE = 'NEXA';
const BUNDLE_ID = 'com.g88';
const NEXA_URL_SCHEME = 'nexa';

if (process.platform !== 'darwin') {
  throw new Error('[ios-bootstrap] iOS native bootstrap requires macOS.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const iosRoot = path.join(mobileRoot, 'ios');
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'nexa-ios-bootstrap-'));
const generatedRoot = path.join(tempRoot, APP_NAME);
const npxPath = path.join(path.dirname(process.execPath), 'npx');

if (!existsSync(npxPath)) {
  throw new Error(`[ios-bootstrap] npx was not found next to the active Node executable: ${npxPath}`);
}

try {
  console.log(
    `[ios-bootstrap] generating ${APP_NAME} from React Native ${REACT_NATIVE_VERSION} with CLI ${CLI_VERSION}`,
  );

  const result = spawnSync(
    npxPath,
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

  const infoPlistPath = path.join(iosRoot, APP_NAME, 'Info.plist');
  let infoPlist = readFileSync(infoPlistPath, 'utf8');
  const schemeMarker = `<string>${NEXA_URL_SCHEME}</string>`;
  if (!infoPlist.includes(schemeMarker)) {
    const urlTypes = [
      '\t<key>CFBundleURLTypes</key>',
      '\t<array>',
      '\t\t<dict>',
      '\t\t\t<key>CFBundleTypeRole</key>',
      '\t\t\t<string>Editor</string>',
      '\t\t\t<key>CFBundleURLSchemes</key>',
      '\t\t\t<array>',
      `\t\t\t\t<string>${NEXA_URL_SCHEME}</string>`,
      '\t\t\t</array>',
      '\t\t</dict>',
      '\t</array>',
    ].join('\n');
    const rootClose = /\n<\/dict>\n<\/plist>\s*$/;
    if (!rootClose.test(infoPlist)) {
      throw new Error('[ios-bootstrap] could not locate the root Info.plist dictionary.');
    }
    infoPlist = infoPlist.replace(rootClose, `\n${urlTypes}\n</dict>\n</plist>\n`);
    writeFileSync(infoPlistPath, infoPlist, 'utf8');
  }

  if (!readFileSync(infoPlistPath, 'utf8').includes(schemeMarker)) {
    throw new Error('[ios-bootstrap] NEXA URL scheme registration is missing from Info.plist.');
  }

  const appDelegatePath = path.join(iosRoot, APP_NAME, 'AppDelegate.swift');
  let appDelegate = readFileSync(appDelegatePath, 'utf8');
  const linkingForwarderMarker = 'RCTLinkingManager.application(app, open: url, options: options)';
  if (!appDelegate.includes(linkingForwarderMarker)) {
    const reactNativeDelegateMarker = '\n}\n\nclass ReactNativeDelegate:';
    if (!appDelegate.includes(reactNativeDelegateMarker)) {
      throw new Error('[ios-bootstrap] could not locate the AppDelegate class boundary.');
    }
    const linkingForwarder = [
      '',
      '  func application(',
      '    _ app: UIApplication,',
      '    open url: URL,',
      '    options: [UIApplication.OpenURLOptionsKey: Any] = [:]',
      '  ) -> Bool {',
      '    RCTLinkingManager.application(app, open: url, options: options)',
      '  }',
    ].join('\n');
    appDelegate = appDelegate.replace(
      reactNativeDelegateMarker,
      `${linkingForwarder}\n}\n\nclass ReactNativeDelegate:`,
    );
    writeFileSync(appDelegatePath, appDelegate, 'utf8');
  }

  if (!readFileSync(appDelegatePath, 'utf8').includes(linkingForwarderMarker)) {
    throw new Error('[ios-bootstrap] NEXA deep-link forwarding is missing from AppDelegate.swift.');
  }

  console.log(`[ios-bootstrap] native iOS shell ready at ${iosRoot}`);
} finally {
  rmSync(tempRoot, {recursive: true, force: true});
}
