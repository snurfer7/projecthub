#!/usr/bin/env bash
# ==============================================================================
# ProjectHub デプロイスクリプト
#
# 使い方:
#   ./scripts/deploy.sh [オプション]
#
# 実行開始時にデプロイ先（本番 / デモ / 開発）を対話で選択します。
#
# オプション:
#   --backend-only         バックエンドのみデプロイ
#   --frontend-only        フロントエンドのみデプロイ
#   --skip-build           ビルドをスキップ（アップロードのみ）
#   --skip-migrate         DB マイグレーションをスキップ
#   --seed                 初回セットアップ用シード（管理者・権限データ）を実行
#   --seed-perm            権限シードのみ実行
#   -h, --help             ヘルプを表示
#
# 設定ファイル（いずれも .gitignore）:
#   scripts/deploy_prod.conf / deploy_demo.conf / deploy_dev.conf
#   SSH 鍵: scripts/ssh/*.pem
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ------------------------------------------------------------------------------
# カラー出力
# ------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${GREEN}===${NC} $* ${GREEN}===${NC}"; }

# 設定ファイルから表示用の値を取得（source しない）
conf_var() {
  local file="$1" key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | sed -E "s/^${key}=//" | tr -d '"'
}

# ------------------------------------------------------------------------------
# デプロイ先の対話選択
# ------------------------------------------------------------------------------
prompt_deploy_env() {
  if [[ ! -t 0 ]]; then
    error "デプロイ先は対話式で選ぶ必要があります。ターミナルで ./scripts/deploy.sh を実行してください。"
    exit 1
  fi

  local -a ENV_KEYS=(prod demo dev)
  local -a ENV_LABELS=(本番 デモ 開発)

  echo ""
  echo "=============================================="
  echo " デプロイ先の環境を選んでください"
  echo "=============================================="
  echo ""

  local i
  for i in "${!ENV_KEYS[@]}"; do
    local key="${ENV_KEYS[$i]}"
    local label="${ENV_LABELS[$i]}"
    local conf="${SCRIPT_DIR}/deploy_${key}.conf"
    if [[ -f "${conf}" ]]; then
      local host api
      host="$(conf_var "${conf}" SERVER_HOST)"
      api="$(conf_var "${conf}" VITE_API_URL)"
      printf "  %s) %s（%s）\n" "$((i + 1))" "${label}" "${key}"
      printf "      %s\n" "${host}"
      printf "      %s\n" "${api}"
    else
      printf "  %s) %s（%s）— 未設定（deploy_%s.conf がありません）\n" "$((i + 1))" "${label}" "${key}" "${key}"
    fi
    echo ""
  done

  while true; do
    read -rp "番号を入力 (1-3 / q=中止): " choice
    case "${choice}" in
      q|Q)
        echo "中止しました。"
        exit 0
        ;;
      1|2|3)
        DEPLOY_ENV="${ENV_KEYS[$((choice - 1))]}"
        CONF_FILE="${SCRIPT_DIR}/deploy_${DEPLOY_ENV}.conf"
        if [[ ! -f "${CONF_FILE}" ]]; then
          warn "設定ファイルがありません: ${CONF_FILE}"
          echo "  cp scripts/deploy.conf.sample scripts/deploy_${DEPLOY_ENV}.conf"
          echo ""
          continue
        fi
        break
        ;;
      *)
        warn "1〜3、または q を入力してください。"
        ;;
    esac
  done
}

# ------------------------------------------------------------------------------
# オプション解析
# ------------------------------------------------------------------------------
DEPLOY_ENV=""
CONF_FILE=""
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
SKIP_BUILD=false
SKIP_MIGRATE=false
RUN_SEED=false
RUN_SEED_PERM=false

usage() {
  sed -n '/^# 使い方:/,/^# ===/p' "$0" | grep '^#' | sed 's/^# \{0,2\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only)   DEPLOY_FRONTEND=false; shift ;;
    --frontend-only)  DEPLOY_BACKEND=false; shift ;;
    --skip-build)     SKIP_BUILD=true; shift ;;
    --skip-migrate)   SKIP_MIGRATE=true; shift ;;
    --seed)           RUN_SEED=true; shift ;;
    --seed-perm)      RUN_SEED_PERM=true; shift ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      error "不明なオプション: $1"
      echo "ヘルプ: $0 --help"
      exit 1
      ;;
  esac
done

prompt_deploy_env

# ------------------------------------------------------------------------------
# 設定ファイルの読み込み
# ------------------------------------------------------------------------------
# shellcheck source=/dev/null
source "${CONF_FILE}"

# ------------------------------------------------------------------------------
# 設定値の検証
# ------------------------------------------------------------------------------
: "${SERVER_HOST:?${CONF_FILE} に SERVER_HOST が設定されていません}"
: "${SERVER_USER:?${CONF_FILE} に SERVER_USER が設定されていません}"
: "${SSH_KEY:?${CONF_FILE} に SSH_KEY が設定されていません}"
: "${VITE_API_URL:?${CONF_FILE} に VITE_API_URL が設定されていません}"
: "${REMOTE_APP_DIR:=/var/www/projecthub}"
: "${PM2_APP_NAME:=projecthub-backend}"

SERVER="${SERVER_USER}@${SERVER_HOST}"

# ~ を展開し、相対パスはプロジェクトルート基準
SSH_KEY_PATH="${SSH_KEY/#\~/$HOME}"
if [[ "${SSH_KEY_PATH}" != /* ]]; then
  SSH_KEY_PATH="${PROJECT_ROOT}/${SSH_KEY_PATH}"
fi

# SSH オプションをアレイで管理（単語分割バグを防ぐ）
SSH_OPTS=(-i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15)

# rsync の -e オプション用（シングルクォートでパス内スペースに対応）
RSYNC_SSH_CMD="ssh -i '${SSH_KEY_PATH}' -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15"

# ------------------------------------------------------------------------------
# デプロイ内容の確認
# ------------------------------------------------------------------------------
echo ""
echo "----------------------------------------------"
echo " 以下の環境にデプロイします"
echo "----------------------------------------------"
info "環境: ${DEPLOY_ENV}"
info "設定: ${CONF_FILE}"
info "接続先: ${SERVER}"
info "リモートディレクトリ: ${REMOTE_APP_DIR}"
info "API URL: ${VITE_API_URL}"
local_deploy_parts=()
[[ "${DEPLOY_BACKEND}" == "true" ]] && local_deploy_parts+=("バックエンド")
[[ "${DEPLOY_FRONTEND}" == "true" ]] && local_deploy_parts+=("フロントエンド")
info "対象: ${local_deploy_parts[*]:-なし}"
[[ "${SKIP_BUILD}" == "true" ]] && warn "ビルドはスキップされます"
[[ "${SKIP_MIGRATE}" == "true" ]] && warn "DB マイグレーションはスキップされます"
[[ "${RUN_SEED}" == "true" ]] && warn "シード（--seed）を実行します"
[[ "${RUN_SEED_PERM}" == "true" ]] && warn "権限シード（--seed-perm）を実行します"
echo ""
read -rp "この内容でデプロイを開始しますか? [y/N]: " deploy_confirm
if [[ ! "${deploy_confirm}" =~ ^[yY]$ ]]; then
  echo "中止しました。"
  exit 0
fi

# ------------------------------------------------------------------------------
# 開始メッセージ
# ------------------------------------------------------------------------------
echo ""
echo "=============================================="
echo " ProjectHub デプロイ開始"
echo "=============================================="
echo ""

# ------------------------------------------------------------------------------
# SSH 鍵のパーミッション確認・接続テスト
# ------------------------------------------------------------------------------
if [[ ! -f "${SSH_KEY_PATH}" ]]; then
  error "SSH 鍵ファイルが見つかりません: ${SSH_KEY_PATH}"
  error "Lightsail の .pem を scripts/ssh/ に配置し、${CONF_FILE} の SSH_KEY を確認してください"
  exit 1
fi
chmod 400 "${SSH_KEY_PATH}"

info "SSH 接続を確認中..."
if ! ssh "${SSH_OPTS[@]}" "${SERVER}" 'echo connected' &>/dev/null; then
  error "SSH 接続に失敗しました"
  error "  環境   : ${DEPLOY_ENV}"
  error "  接続先 : ${SERVER}"
  error "  鍵ファイル: ${SSH_KEY_PATH}"
  error ""
  error "確認事項:"
  error "  1. SERVER_HOST が正しい Public IP か確認してください"
  error "  2. SSH_KEY のパスが正しいか確認してください"
  error "  3. Lightsail ファイアウォールでポート 22 が開いているか確認してください"
  error ""
  error "手動で接続テスト: ssh -i ${SSH_KEY_PATH} ${SERVER}"
  exit 1
fi
success "SSH 接続確認 OK"

# ------------------------------------------------------------------------------
# バックエンド ビルド
# ------------------------------------------------------------------------------
if [[ "${DEPLOY_BACKEND}" == "true" && "${SKIP_BUILD}" == "false" ]]; then
  step "Backend ビルド"
  cd "${PROJECT_ROOT}/backend"
  npm install
  npx prisma generate
  npm run build
  success "Backend ビルド完了"
  cd "${PROJECT_ROOT}"
fi

# ------------------------------------------------------------------------------
# フロントエンド ビルド
# ------------------------------------------------------------------------------
if [[ "${DEPLOY_FRONTEND}" == "true" && "${SKIP_BUILD}" == "false" ]]; then
  step "Frontend ビルド"
  cd "${PROJECT_ROOT}/frontend"
  npm install
  VITE_API_URL="${VITE_API_URL}" npm run build
  success "Frontend ビルド完了"
  cd "${PROJECT_ROOT}"
fi

# ------------------------------------------------------------------------------
# バックエンド アップロード
# ------------------------------------------------------------------------------
if [[ "${DEPLOY_BACKEND}" == "true" ]]; then
  step "Backend アップロード"

  info "dist/ をアップロード中..."
  rsync -avz --delete \
    -e "${RSYNC_SSH_CMD}" \
    "${PROJECT_ROOT}/backend/dist/" \
    "${SERVER}:${REMOTE_APP_DIR}/backend/dist/"

  info "package.json をアップロード中..."
  scp "${SSH_OPTS[@]}" \
    "${PROJECT_ROOT}/backend/package.json" \
    "${PROJECT_ROOT}/backend/package-lock.json" \
    "${SERVER}:${REMOTE_APP_DIR}/backend/"

  info "Prisma スキーマをアップロード中..."
  rsync -avz \
    -e "${RSYNC_SSH_CMD}" \
    "${PROJECT_ROOT}/backend/prisma/" \
    "${SERVER}:${REMOTE_APP_DIR}/backend/prisma/"

  success "Backend アップロード完了"
fi

# ------------------------------------------------------------------------------
# フロントエンド アップロード
# ------------------------------------------------------------------------------
if [[ "${DEPLOY_FRONTEND}" == "true" ]]; then
  step "Frontend アップロード"

  rsync -avz --delete \
    -e "${RSYNC_SSH_CMD}" \
    "${PROJECT_ROOT}/frontend/dist/" \
    "${SERVER}:${REMOTE_APP_DIR}/frontend/"

  success "Frontend アップロード完了"
fi

# ------------------------------------------------------------------------------
# サーバー側処理（Backend 更新時のみ）
# ------------------------------------------------------------------------------
if [[ "${DEPLOY_BACKEND}" == "true" ]]; then
  step "サーバー側処理"

  # サーバーで実行するコマンドを構築
  SERVER_COMMANDS="set -e
cd ${REMOTE_APP_DIR}/backend
echo '--- npm install ---'
npm install --omit=dev
echo '--- prisma generate ---'
npx prisma generate"

  if [[ "${SKIP_MIGRATE}" == "false" ]]; then
    SERVER_COMMANDS+="
echo '--- prisma migrate deploy ---'
npx prisma migrate deploy"
  fi

  if [[ "${RUN_SEED}" == "true" ]]; then
    SERVER_COMMANDS+="
echo '--- seed (管理者・マスタ・権限) ---'
npm run prisma:seed:prod"
  elif [[ "${RUN_SEED_PERM}" == "true" ]]; then
    SERVER_COMMANDS+="
echo '--- seed (権限カタログのみ) ---'
npm run prisma:seed:permissions:prod"
  fi

  SERVER_COMMANDS+="
echo '--- pm2 restart ---'
pm2 restart ${PM2_APP_NAME} || pm2 start dist/index.js --name ${PM2_APP_NAME} --env production
pm2 save"

  ssh "${SSH_OPTS[@]}" "${SERVER}" "${SERVER_COMMANDS}"

  success "サーバー側処理完了"
fi

# ------------------------------------------------------------------------------
# 完了
# ------------------------------------------------------------------------------
echo ""
echo "=============================================="
echo -e " ${GREEN}デプロイ完了${NC}（環境: ${DEPLOY_ENV}）"
echo "=============================================="
if [[ "${DEPLOY_FRONTEND}" == "true" ]]; then
  info "フロントエンド: ${VITE_API_URL%/api}"
fi
if [[ "${DEPLOY_BACKEND}" == "true" ]]; then
  info "バックエンドログ確認: ssh -i ${SSH_KEY_PATH} ${SERVER} 'pm2 logs ${PM2_APP_NAME} --lines 30'"
fi
echo ""
