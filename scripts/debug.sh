#!/usr/bin/env bash
# WSL2からWindowsホストのAndroidエミュレーターを使ったデバッグスクリプト

set -e

# ===== 設定 =====
WINDOWS_USER="Hidenori"
ADB_WIN="/mnt/c/Users/${WINDOWS_USER}/AppData/Local/Android/Sdk/platform-tools/adb.exe"
PACKAGE_NAME="com.projecthub.android"

# このスクリプト自身の場所から android/ プロジェクトのパスを解決
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(cd "${SCRIPT_DIR}/../android" && pwd)"

# 使用するデバイスのシリアル番号（空の場合は自動選択 or 一覧表示して選択）
# 環境変数で上書き可能: DEVICE=emulator-5554 ./debug.sh run
DEVICE="${DEVICE:-}"

# WSL2からWindowsホストはlocalhostで到達可能
HOST_IP="localhost"

# JAVA_HOME: WSLのJava 17を使用
if [ -z "$JAVA_HOME" ]; then
  WSL_JAVA=$(update-java-alternatives -l 2>/dev/null | awk '{print $3}' | head -1)
  if [ -n "$WSL_JAVA" ]; then
    export JAVA_HOME="$WSL_JAVA"
  fi
fi

# ANDROID_HOME: WindowsのSDKをWSLパスで参照
if [ -z "$ANDROID_HOME" ]; then
  export ANDROID_HOME="/mnt/c/Users/${WINDOWS_USER}/AppData/Local/Android/Sdk"
fi

# ===== ヘルパー関数 =====
usage() {
  cat <<EOF
使い方: ./scripts/debug.sh [コマンド]

コマンド:
  connect       WindowsエミュレーターにアDB接続
  disconnect    ADB接続を切断
  devices       接続デバイス一覧を表示
  build         デバッグビルド
  install       ビルド & エミュレーターにインストール
  run           ビルド & インストール & アプリ起動
  uninstall     アプリをアンインストール
  logcat        アプリのLogcatを表示（Ctrl+Cで終了）
  clear-log     Logcatをクリア
  status        接続状態とデバイス情報を表示

オプションなしで実行すると run を実行します。
EOF
}

adb_cmd() {
  local adb_bin
  if [ -f "$ADB_WIN" ]; then
    adb_bin="$ADB_WIN"
  else
    adb_bin="adb"
  fi

  if [ -n "$DEVICE" ]; then
    "$adb_bin" -s "$DEVICE" "$@"
  else
    "$adb_bin" "$@"
  fi
}

select_device() {
  # デバイスが複数ある場合は選択を促す（adb.exeのCRLF出力に対応）
  local devices
  devices=$(adb_cmd devices | tr -d '\r' | grep -v "^List" | grep "device$" | awk '{print $1}')
  local count
  count=$(echo "$devices" | grep -c '\S' || true)

  if [ "$count" -eq 0 ]; then
    echo "エラー: 接続済みデバイスが見つかりません"
    exit 1
  elif [ "$count" -eq 1 ]; then
    DEVICE=$(echo "$devices" | head -1)
  else
    echo "複数のデバイスが接続されています:"
    local i=1
    while IFS= read -r serial; do
      echo "  $i) $serial"
      i=$((i + 1))
    done <<< "$devices"
    printf "使用するデバイス番号を入力 [1]: "
    read -r choice
    choice="${choice:-1}"
    DEVICE=$(echo "$devices" | sed -n "${choice}p")
  fi
  echo ">> デバイス: ${DEVICE}"
}

# ===== コマンド実装 =====
cmd_connect() {
  echo ">> Windowsエミュレーターに接続中... (IP: ${HOST_IP})"
  adb_cmd connect "${HOST_IP}:5555"
  echo ">> 接続済みデバイス:"
  adb_cmd devices
}

cmd_disconnect() {
  echo ">> ADB接続を切断中..."
  adb_cmd disconnect "${HOST_IP}:5555"
}

cmd_devices() {
  echo ">> 接続済みデバイス:"
  adb_cmd devices -l
}

cmd_build() {
  echo ">> デバッグビルド中..."
  (cd "$ANDROID_DIR" && ./gradlew assembleDebug)
  echo ">> ビルド完了: android/app/build/outputs/apk/debug/app-debug.apk"
}

cmd_install() {
  [ -z "$DEVICE" ] && select_device
  echo ">> ビルド中..."
  (cd "$ANDROID_DIR" && ./gradlew assembleDebug)
  echo ">> インストール中..."
  adb_cmd install -r "${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
  echo ">> インストール完了"
}

cmd_run() {
  [ -z "$DEVICE" ] && select_device
  cmd_install
  echo ">> アプリを起動中..."
  adb_cmd shell am start -n "${PACKAGE_NAME}/.MainActivity"
}

cmd_uninstall() {
  echo ">> アンインストール中..."
  adb_cmd uninstall "${PACKAGE_NAME}"
}

cmd_logcat() {
  echo ">> Logcat起動 (Ctrl+C で終了)..."
  adb_cmd logcat --pid="$(adb_cmd shell pidof -s "${PACKAGE_NAME}")" 2>/dev/null \
    || adb_cmd logcat -s "ProjectHub" "*:E"
}

cmd_clear_log() {
  echo ">> Logcatをクリア中..."
  adb_cmd logcat -c
  echo ">> クリア完了"
}

cmd_status() {
  echo "===== 接続ステータス ====="
  echo "ホストIP     : ${HOST_IP}"
  echo "ADB (Windows): ${ADB_WIN}"
  echo ""
  echo "===== デバイス一覧 ====="
  adb_cmd devices -l
  echo ""
  echo "===== ADBバージョン ====="
  adb_cmd version
}

# ===== メイン =====
COMMAND="${1:-run}"

case "$COMMAND" in
  connect)     cmd_connect ;;
  disconnect)  cmd_disconnect ;;
  devices)     cmd_devices ;;
  build)       cmd_build ;;
  install)     cmd_install ;;
  run)         cmd_run ;;
  uninstall)   cmd_uninstall ;;
  logcat)      cmd_logcat ;;
  clear-log)   cmd_clear_log ;;
  status)      cmd_status ;;
  help|--help|-h) usage ;;
  *)
    echo "エラー: 不明なコマンド '$COMMAND'"
    usage
    exit 1
    ;;
esac
