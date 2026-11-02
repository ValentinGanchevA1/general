#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="${DEVICE_E2E_STATE_FILE:-.tmp/android-two-device-privacy.json}"
APK_PATH="${DEVICE_E2E_APK_PATH:-apps/mobile/android/app/build/outputs/apk/release/app-release.apk}"
SERIAL_A="${DEVICE_E2E_SERIAL_A:-emulator-5554}"
SERIAL_B="${DEVICE_E2E_SERIAL_B:-emulator-5556}"
UI=(python3 scripts/android-two-device-ui.py)
PACKAGE=com.g88
PROBE_PREFIX='[NEXA_E2E_DEVICE]'

state() {
  node -e '
    const fs = require("fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    let value = state;
    for (const part of process.argv[2].split(".")) value = value[part];
    if (typeof value !== "string") throw new Error(`state ${process.argv[2]} is not a string`);
    process.stdout.write(value);
  ' "$STATE_FILE" "$1"
}

device_alias() {
  case "$1" in
    "$SERIAL_A") printf 'a' ;;
    "$SERIAL_B") printf 'b' ;;
    *) echo "::error::Unsupported Android E2E serial" >&2; return 1 ;;
  esac
}

ui() {
  local serial="$1"
  local device
  shift
  device="$(device_alias "$serial")"
  "${UI[@]}" --device "$device" "$@"
}

launch_app() {
  local serial="$1"
  adb -s "$serial" shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null
}

reset_app() {
  local serial="$1"
  adb -s "$serial" shell pm clear "$PACKAGE" >/dev/null
  adb -s "$serial" shell pm grant "$PACKAGE" android.permission.ACCESS_COARSE_LOCATION
  adb -s "$serial" shell pm grant "$PACKAGE" android.permission.ACCESS_FINE_LOCATION
}

dismiss_map_coachmark() {
  local serial="$1"
  if ui "$serial" wait --value 'Skip' --timeout 3 >/dev/null 2>&1; then
    ui "$serial" tap --value 'Skip' --timeout 5
    ui "$serial" wait --value 'Connections, chats and activity' --timeout 15
  fi
}

login() {
  local serial="$1"
  local email="$2"
  local password="$3"

  launch_app "$serial"
  ui "$serial" wait --value 'Email' --timeout 75
  ui "$serial" tap --value 'Email'
  ui "$serial" type --value "$email"
  ui "$serial" wait --value "$email" --timeout 10
  ui "$serial" tap --value 'Password'
  ui "$serial" type --value "$password"
  ui "$serial" key --name back
  ui "$serial" tap --value 'Sign in' --timeout 15
  ui "$serial" wait --value 'Connections, chats and activity' --timeout 90
  dismiss_map_coachmark "$serial"
}

open_chat() {
  local serial="$1"
  local peer_name="$2"

  ui "$serial" tap --value 'Connections, chats and activity' --timeout 30
  ui "$serial" wait --value 'Connections' --timeout 30
  ui "$serial" tap --value 'Chats' --timeout 20
  ui "$serial" wait --value "Chat with ${peer_name}" --contains --timeout 45
  ui "$serial" tap --value "Chat with ${peer_name}" --contains --timeout 10
  ui "$serial" wait --value "Open profile for ${peer_name}" --timeout 30
}

login_pair_and_open_chats() {
  local left_serial="$1"
  local left_email="$2"
  local left_name="$3"
  local right_serial="$4"
  local right_email="$5"
  local right_name="$6"
  local password="$7"

  login "$left_serial" "$left_email" "$password"
  login "$right_serial" "$right_email" "$password"
  open_chat "$left_serial" "$right_name"
  open_chat "$right_serial" "$left_name"
}

wait_probe() {
  local serial="$1"
  local event="$2"
  local timeout_seconds="${3:-25}"
  local deadline=$((SECONDS + timeout_seconds))
  while (( SECONDS < deadline )); do
    if adb -s "$serial" logcat -d 2>/dev/null | grep -Fq "${PROBE_PREFIX} ${event}"; then
      echo "[device-e2e] ${serial} observed ${event}"
      return 0
    fi
    sleep 1
  done
  echo "::error::${serial} did not observe ${event}" >&2
  return 1
}

assert_no_probe() {
  local serial="$1"
  local event="$2"
  local window_seconds="${3:-10}"
  sleep "$window_seconds"
  if adb -s "$serial" logcat -d 2>/dev/null | grep -Fq "${PROBE_PREFIX} ${event}"; then
    echo "::error::${serial} received forbidden ${event} after revocation" >&2
    adb -s "$serial" logcat -d 2>/dev/null | grep -F "$PROBE_PREFIX" >&2 || true
    return 1
  fi
  echo "[device-e2e] ${serial} received no ${event} during ${window_seconds}s revocation window"
}

set_geo() {
  local serial="$1"
  local lng="$2"
  local lat="$3"
  adb -s "$serial" emu geo fix "$lng" "$lat" >/dev/null
}

start_share_and_prove_update() {
  local sharer_serial="$1"
  local viewer_serial="$2"
  local sharer_name="$3"

  adb -s "$viewer_serial" logcat -c
  set_geo "$sharer_serial" 27.93461 43.21357
  ui "$sharer_serial" tap --value 'Share live location' --timeout 20
  ui "$sharer_serial" wait --value 'Share live location' --timeout 20
  ui "$sharer_serial" tap --value 'Share' --timeout 20
  ui "$viewer_serial" wait --value "${sharer_name} is sharing live location" --contains --timeout 35
  wait_probe "$viewer_serial" location_started 30

  adb -s "$viewer_serial" logcat -c
  sleep 6
  set_geo "$sharer_serial" 27.93520 43.21410
  wait_probe "$viewer_serial" location_update 25
}

block_peer() {
  local serial="$1"
  local peer_name="$2"

  ui "$serial" tap --value "Open profile for ${peer_name}" --timeout 20
  ui "$serial" wait --value 'More options' --timeout 30
  ui "$serial" tap --value 'More options'
  ui "$serial" wait --value 'Block user' --timeout 20
  ui "$serial" tap --value 'Block user'
  ui "$serial" wait --value "Block ${peer_name}?" --timeout 20
  ui "$serial" tap --value 'Block' --timeout 10
  ui "$serial" wait --value 'Blocked' --timeout 30
  ui "$serial" tap --value 'OK' --timeout 10
}

stop_share_if_visible() {
  local serial="$1"
  if ui "$serial" wait --value 'Stop' --timeout 3 >/dev/null 2>&1; then
    ui "$serial" tap --value 'Stop' --timeout 5
  fi
}

main() {
  test -f "$APK_PATH" || { echo "::error::APK not found: $APK_PATH"; exit 1; }
  test -f "$STATE_FILE" || { echo "::error::state file not found: $STATE_FILE"; exit 1; }

  local password a_email b_email a_name b_name c_email d_email c_name d_name
  password="$(state password)"
  a_email="$(state a.email)"
  b_email="$(state b.email)"
  a_name="$(state a.displayName)"
  b_name="$(state b.displayName)"
  c_email="$(state c.email)"
  d_email="$(state d.email)"
  c_name="$(state c.displayName)"
  d_name="$(state d.displayName)"

  echo '[device-e2e] installing probe-enabled release APK on both emulators'
  adb -s "$SERIAL_A" install -r "$APK_PATH" >/dev/null
  adb -s "$SERIAL_B" install -r "$APK_PATH" >/dev/null
  reset_app "$SERIAL_A"
  reset_app "$SERIAL_B"

  echo '[device-e2e] logging in revocation pair A/B'
  login_pair_and_open_chats "$SERIAL_A" "$a_email" "$a_name" "$SERIAL_B" "$b_email" "$b_name" "$password"

  echo '[device-e2e] proving authorized live-location delivery before block'
  start_share_and_prove_update "$SERIAL_A" "$SERIAL_B" "$a_name"

  echo '[device-e2e] blocking B while B remains connected and joined'
  block_peer "$SERIAL_A" "$b_name"

  echo '[device-e2e] proving no precise update is delivered after revocation'
  adb -s "$SERIAL_B" logcat -c
  sleep 6
  set_geo "$SERIAL_A" 27.93600 43.21500
  assert_no_probe "$SERIAL_B" location_update 10

  echo '[device-e2e] forcing B process reconnect and verifying blocked conversation does not return'
  adb -s "$SERIAL_B" shell am force-stop "$PACKAGE"
  adb -s "$SERIAL_B" logcat -c
  launch_app "$SERIAL_B"
  ui "$SERIAL_B" wait --value 'Connections, chats and activity' --timeout 75
  ui "$SERIAL_B" tap --value 'Connections, chats and activity'
  ui "$SERIAL_B" wait --value 'Connections' --timeout 30
  ui "$SERIAL_B" tap --value 'Chats' --timeout 20
  ui "$SERIAL_B" assert-absent --value "Chat with ${a_name}" --contains --timeout 8
  assert_no_probe "$SERIAL_B" location_started 5
  assert_no_probe "$SERIAL_B" location_update 1

  echo '[device-e2e] switching to independent fresh authorized pair C/D'
  reset_app "$SERIAL_A"
  reset_app "$SERIAL_B"
  login_pair_and_open_chats "$SERIAL_A" "$c_email" "$c_name" "$SERIAL_B" "$d_email" "$d_name" "$password"
  start_share_and_prove_update "$SERIAL_A" "$SERIAL_B" "$c_name"
  stop_share_if_visible "$SERIAL_A"

  echo '✅ Android two-device realtime privacy E2E passed'
}

main "$@"
