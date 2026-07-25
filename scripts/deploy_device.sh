#!/bin/bash
# Deploy debug APK to an Android device (USB or wireless) from WSL2,
# via the Windows-side adb.exe (avoids running a second ADB server in WSL).
set -uo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
WINDOWS_USER="${WINDOWS_USER:-Hidenori}"
ADB="${ADB_BIN:-/mnt/c/Users/${WINDOWS_USER}/AppData/Local/Android/Sdk/platform-tools/adb.exe}"
APP_ID="com.projecthub.android"
MAIN_ACTIVITY=".MainActivity"
PROJECT_DIR="$(cd "$(dirname "$0")/../android" && pwd)"
ADB_WAIT_SECONDS=60
ADB_POLL_INTERVAL=2
ENDPOINT_CACHE="$HOME/.cache/projecthub-android/adb_endpoint"
CACHE_MAX=5

# ─── Flags ────────────────────────────────────────────────────────────────────
NO_LAUNCH=false
WIRELESS=false
WIRELESS_ENDPOINT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-launch)
      NO_LAUNCH=true
      shift ;;
    --wireless)
      WIRELESS=true
      if [ $# -gt 1 ] && [[ "$2" != --* ]]; then
        WIRELESS_ENDPOINT="$2"
        shift
      fi
      shift ;;
    -h|--help)
      cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Builds the debug APK and installs it on an Android device via the
Windows-side adb.exe (WSL2). Defaults to USB.

OPTIONS:
  --wireless [IP:PORT]  Connect over Wi-Fi instead of USB.
                         Omit IP:PORT to pick from cached devices or be prompted.
  --no-launch            Install only; don't start the app afterward.
  -h, --help             Show this help.

EXAMPLES:
  ./scripts/deploy_device.sh
  ./scripts/deploy_device.sh --wireless
  ./scripts/deploy_device.sh --wireless 192.168.1.5:39517
  ./scripts/deploy_device.sh --no-launch
EOF
      exit 0 ;;
    *)
      shift ;;
  esac
done

# ─── Log helpers ──────────────────────────────────────────────────────────────
info()  { echo "[INFO]  $*"; }
warn()  { echo "[WARN]  $*" >&2; }
die()   { local code=$1; shift; echo "[ERROR] $*" >&2; exit "$code"; }

# ─── Cache helpers ────────────────────────────────────────────────────────────

# Load cache into CACHED_ENDPOINTS array (skips blank lines)
load_cache() {
  CACHED_ENDPOINTS=()
  if [ ! -f "$ENDPOINT_CACHE" ]; then return; fi
  local raw=()
  mapfile -t raw < "$ENDPOINT_CACHE"
  local e
  for e in "${raw[@]:-}"; do
    [ -n "$e" ] && CACHED_ENDPOINTS+=("$e")
  done
}

# Save endpoint to cache: prepend, dedup by IP, trim to CACHE_MAX
save_endpoint() {
  local ep="$1"
  local ip="${ep%%:*}"
  local cache_dir
  cache_dir="$(dirname "$ENDPOINT_CACHE")"
  mkdir -p "$cache_dir"

  load_cache
  local entries=("$ep")
  local e
  for e in "${CACHED_ENDPOINTS[@]:-}"; do
    [ "${e%%:*}" = "$ip" ] && continue   # dedup: keep only newest port per IP
    entries+=("$e")
  done

  local tmp
  tmp=$(mktemp "$cache_dir/.adb_endpoint.XXXXXX")
  printf '%s\n' "${entries[@]:0:$CACHE_MAX}" > "$tmp"
  mv "$tmp" "$ENDPOINT_CACHE"
}

# ─── Phase 0: Environment check ───────────────────────────────────────────────
info "Phase 0: Checking environment..."

[ -x "$ADB" ]                 || die 10 "adb.exe not found at $ADB. Check WINDOWS_USER or install the Android SDK on Windows (see doc/BUILD.md)."
[ -f "$PROJECT_DIR/gradlew" ] || die 10 "gradlew not found in $PROJECT_DIR."

java_version=$(java -version 2>&1 | head -1)
if ! echo "$java_version" | grep -qE '"(17|21|22|23)'; then
  die 10 "Java 17+ required. Found: $java_version"
fi

info "ADB:     $ADB"
info "Project: $PROJECT_DIR"
info "Mode:    $([ "$WIRELESS" = true ] && echo 'wireless' || echo 'USB')"

# ─── Phase 1: Device connection ───────────────────────────────────────────────
info ""

if [ "$WIRELESS" = true ]; then
  # ── Wireless mode ────────────────────────────────────────────────────────────
  info "Phase 1: Wireless connection..."

  # ── Resolve endpoint ─────────────────────────────────────────────────────────
  if [ -z "$WIRELESS_ENDPOINT" ]; then
    load_cache

    if [ "${#CACHED_ENDPOINTS[@]}" -gt 0 ]; then
      if [ ! -t 0 ]; then
        # Non-interactive (pipe/CI): auto-select most recent
        WIRELESS_ENDPOINT="${CACHED_ENDPOINTS[0]}"
        info "Non-interactive mode: using cached endpoint $WIRELESS_ENDPOINT"
      else
        echo ""
        echo "  Select a device or enter a new IP:PORT:"
        for i in "${!CACHED_ENDPOINTS[@]}"; do
          label=""
          [ "$i" -eq 0 ] && label=" (last used)"
          echo "  [$((i+1))] ${CACHED_ENDPOINTS[$i]}$label"
        done
        echo ""
        read -rp "[INPUT]  Number or IP:PORT (Enter = [1]): " selection

        if [ -z "$selection" ]; then
          WIRELESS_ENDPOINT="${CACHED_ENDPOINTS[0]}"
        elif [[ "$selection" =~ ^[0-9]+$ ]]; then
          idx=$((selection - 1))
          if [ "$idx" -lt 0 ] || [ "$idx" -ge "${#CACHED_ENDPOINTS[@]}" ]; then
            die 20 "Invalid selection: $selection (choose 1-${#CACHED_ENDPOINTS[@]})"
          fi
          WIRELESS_ENDPOINT="${CACHED_ENDPOINTS[$idx]}"
        elif [[ "$selection" == *:* ]]; then
          WIRELESS_ENDPOINT="$selection"
        else
          die 20 "Invalid input. Enter a number or IP:PORT (e.g. 192.168.1.5:39517)"
        fi
      fi
    else
      read -rp "[INPUT]  Enter device IP:PORT (e.g. 192.168.1.5:39517): " WIRELESS_ENDPOINT
      [ -n "$WIRELESS_ENDPOINT" ] || die 20 "No endpoint provided."
    fi
  fi

  info "Connecting to $WIRELESS_ENDPOINT ..."
  "$ADB" start-server &>/dev/null

  # ── Connect helper ────────────────────────────────────────────────────────────
  _wireless_connect() {
    local endpoint="$1"
    local result
    result=$("$ADB" connect "$endpoint" 2>&1)
    echo "$result"
    echo "$result" | grep -qE "connected to|already connected"
  }

  if _wireless_connect "$WIRELESS_ENDPOINT"; then
    save_endpoint "$WIRELESS_ENDPOINT"
    SERIAL="$WIRELESS_ENDPOINT"
    info "Device connected: $SERIAL"
  else
    # ── Diagnose and guide ────────────────────────────────────────────────────
    connect_out=$("$ADB" connect "$WIRELESS_ENDPOINT" 2>&1 || true)
    if echo "$connect_out" | grep -q "failed to authenticate"; then
      warn "Authentication failed — device may not be paired with this PC."
    elif echo "$connect_out" | grep -qE "Connection refused|cannot connect"; then
      warn "Connection refused — the wireless debug port may have changed."
    else
      warn "Connection failed: $connect_out"
    fi
    echo ""
    echo "  On your device:"
    echo "    設定 > 開発者向けオプション > ワイヤレスデバッグ"
    echo "    画面に表示されている IP アドレスとポートを確認してください。"
    echo ""

    # ── Pairing (optional) ────────────────────────────────────────────────────
    IP_PART="${WIRELESS_ENDPOINT%%:*}"
    echo "  初回ペアリングする場合:"
    echo "    「ペアリングコードでデバイスをペアリング」をタップしてください。"
    echo "    （ペアリング用のポートとコードは開くたびに変わります）"
    echo ""
    read -rp "[INPUT]  ペアリング用 IP:PORT または PORT のみ入力（スキップする場合は Enter）: " pair_input

    if [ -n "$pair_input" ]; then
      # Accept either "IP:PORT" or just "PORT"
      if [[ "$pair_input" == *:* ]]; then
        pair_endpoint="$pair_input"
      else
        pair_endpoint="$IP_PART:$pair_input"
      fi

      read -rp "[INPUT]  6桁のペアリングコードを入力: " pair_code

      if ! [[ "$pair_code" =~ ^[0-9]{6}$ ]]; then
        die 20 "Invalid pairing code. Must be exactly 6 digits."
      fi

      info "Pairing with $pair_endpoint ..."
      pair_result=$(timeout 30 "$ADB" pair "$pair_endpoint" "$pair_code" 2>&1) || true
      info "$pair_result"

      if ! echo "$pair_result" | grep -qi "successfully paired"; then
        die 20 "Pairing failed. Make sure the pairing dialog is still open on the device and retry."
      fi
      info "Pairing successful."
      echo ""
    fi

    # ── Retry connect with (possibly updated) port ────────────────────────────
    echo "  ワイヤレスデバッグ画面の「IPアドレスとポート」を確認してください。"
    read -rp "[INPUT]  接続する IP:PORT を入力（デフォルト: $WIRELESS_ENDPOINT）: " new_endpoint
    [ -n "$new_endpoint" ] && WIRELESS_ENDPOINT="$new_endpoint"

    if _wireless_connect "$WIRELESS_ENDPOINT"; then
      save_endpoint "$WIRELESS_ENDPOINT"
      SERIAL="$WIRELESS_ENDPOINT"
      info "Device connected: $SERIAL"
    else
      die 20 "Wireless connection failed. Verify the IP:PORT and that Wireless debugging is enabled on the device."
    fi
  fi

else
  # ── USB mode ──────────────────────────────────────────────────────────────
  # adb.exe runs on Windows, so a device plugged into the PC is visible
  # directly — no WSL2 USB passthrough (usbipd) is needed.
  info "Phase 1: Waiting for USB device..."

  "$ADB" start-server &>/dev/null

  elapsed=0
  SERIAL=""
  while [ $elapsed -lt $ADB_WAIT_SECONDS ]; do
    device_line=$("$ADB" devices 2>/dev/null | awk 'NR>1 && NF==2 {print}' | tr -d '\r')

    authorized=$(echo "$device_line"   | awk '$2=="device"      {print $1}' | head -1)
    unauthorized=$(echo "$device_line" | awk '$2=="unauthorized" {print $1}' | head -1)
    offline=$(echo "$device_line"      | awk '$2=="offline"      {print $1}' | head -1)

    if [ -n "$authorized" ]; then
      count=$(echo "$device_line" | awk '$2=="device" {print $1}' | wc -l)
      if [ "$count" -gt 1 ]; then
        warn "Multiple devices found."
        "$ADB" devices
        die 30 "Ambiguous device. Use: export ANDROID_SERIAL=<serial>"
      fi
      SERIAL="$authorized"
      info "Device connected: $SERIAL"
      break
    elif [ -n "$unauthorized" ]; then
      echo -ne "\r[WAIT]  Unauthorized ($elapsed/${ADB_WAIT_SECONDS}s) — 端末で「USBデバッグを許可」をタップしてください..."
    elif [ -n "$offline" ]; then
      echo -ne "\r[WAIT]  Device offline ($elapsed/${ADB_WAIT_SECONDS}s) — USB接続を確認してください..."
    else
      echo -ne "\r[WAIT]  No device ($elapsed/${ADB_WAIT_SECONDS}s) — 端末をUSB接続し、USBデバッグを有効にしてください..."
    fi

    sleep $ADB_POLL_INTERVAL
    elapsed=$((elapsed + ADB_POLL_INTERVAL))
  done
  echo ""

  [ -n "$SERIAL" ] || die 30 "No authorized device found after ${ADB_WAIT_SECONDS}s. USBケーブルの接続と『USBデバッグ』の許可を確認してください。"
fi

# ─── Phase 2: Build ───────────────────────────────────────────────────────────
info ""
info "Phase 2: Building debug APK..."
cd "$PROJECT_DIR"

if ! ./gradlew assembleDebug; then
  die 40 "Build failed. Check the Gradle output above."
fi

APK_PATH="$PROJECT_DIR/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK_PATH" ] || die 40 "APK not found at $APK_PATH after build."
info "APK: $APK_PATH"

# ─── Phase 3: Install ─────────────────────────────────────────────────────────
info ""
info "Phase 3: Installing on $SERIAL..."

install_output=$("$ADB" -s "$SERIAL" install -r "$APK_PATH" 2>&1) || {
  echo "$install_output"
  if echo "$install_output" | grep -q "INSTALL_FAILED_UPDATE_INCOMPATIBLE"; then
    die 50 "Signature mismatch. Uninstall the existing app first:
    \"$ADB\" -s \"$SERIAL\" uninstall $APP_ID"
  elif echo "$install_output" | grep -q "INSTALL_FAILED_VERSION_DOWNGRADE"; then
    die 50 "Version downgrade not allowed. Uninstall first:
    \"$ADB\" -s \"$SERIAL\" uninstall $APP_ID"
  elif echo "$install_output" | grep -q "INSTALL_FAILED_OLDER_SDK"; then
    die 50 "Device API level too low. This app requires minSdk 26 (Android 8.0)."
  else
    die 50 "Install failed. Output:
$install_output"
  fi
}

info "Install successful."

# ─── Phase 4: Launch ──────────────────────────────────────────────────────────
if [ "$NO_LAUNCH" = true ]; then
  info ""
  info "Skipping launch (--no-launch)."
else
  info ""
  info "Phase 4: Launching app..."
  "$ADB" -s "$SERIAL" shell am start -n "${APP_ID}/${MAIN_ACTIVITY}" \
    || warn "Launch failed. Start the app manually."
fi

info ""
info "Done. App deployed to $SERIAL."
