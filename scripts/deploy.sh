#!/usr/bin/env bash
# ==============================================================================
# ProjectHub デプロイスクリプト
#
# 使い方:
#   ./scripts/deploy.sh [オプション]
#
# オプション:
#   --backend-only    バックエンドのみデプロイ
#   --frontend-only   フロントエンドのみデプロイ
#   --skip-build      ビルドをスキップ（アップロードのみ）
#   --skip-migrate    DB マイグレーションをスキップ
#   --seed            初回セットアップ用シード（管理者・権限データ）を実行
#   --seed-perm       権限シードのみ実行
#   -h, --help        ヘルプを表示
#
# 設定ファイル:
#   scripts/deploy.conf が必要です（deploy.conf.sample を参考に作成してください）
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONF_FILE="${SCRIPT_DIR}/deploy.conf"

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

# ------------------------------------------------------------------------------
# 設定ファイルの読み込み
# ------------------------------------------------------------------------------
if [[ ! -f "${CONF_FILE}" ]]; then
  error "設定ファイルが見つかりません: ${CONF_FILE}"
  echo ""
  echo "以下のコマンドで作成してください:"
  echo "  cp scripts/deploy.conf.sample scripts/deploy.conf"
  echo "  # deploy.conf を編集して各自の環境に合わせてください"
  exit 1
fi

# shellcheck source=deploy.conf
source "${CONF_FILE}"

# ------------------------------------------------------------------------------
# 設定値の検証
# ------------------------------------------------------------------------------
: "${SERVER_HOST:?deploy.conf に SERVER_HOST が設定されていません}"
: "${SERVER_USER:?deploy.conf に SERVER_USER が設定されていません}"
: "${SSH_KEY:?deploy.conf に SSH_KEY が設定されていません}"
: "${VITE_API_URL:?deploy.conf に VITE_API_URL が設定されていません}"
: "${REMOTE_APP_DIR:=/var/www/projecthub}"
: "${PM2_APP_NAME:=projecthub-backend}"

SERVER="${SERVER_USER}@${SERVER_HOST}"

# ~ を展開してパスを解決
SSH_KEY_PATH="${SSH_KEY/#\~/$HOME}"

# SSH オプションをアレイで管理（単語分割バグを防ぐ）
SSH_OPTS=(-i "${SSH_KEY_PATH}" -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15)

# rsync の -e オプション用（シングルクォートでパス内スペースに対応）
RSYNC_SSH_CMD="ssh -i '${SSH_KEY_PATH}' -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15"

# ------------------------------------------------------------------------------
# オプション解析
# ------------------------------------------------------------------------------
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
SKIP_BUILD=false
SKIP_MIGRATE=false
RUN_SEED=false
RUN_SEED_PERM=false

for arg in "$@"; do
  case "${arg}" in
    --backend-only)   DEPLOY_FRONTEND=false ;;
    --frontend-only)  DEPLOY_BACKEND=false ;;
    --skip-build)     SKIP_BUILD=true ;;
    --skip-migrate)   SKIP_MIGRATE=true ;;
    --seed)           RUN_SEED=true ;;
    --seed-perm)      RUN_SEED_PERM=true ;;
    -h|--help)
      sed -n '/^# 使い方:/,/^# ===/p' "$0" | grep '^#' | sed 's/^# \{0,2\}//'
      exit 0
      ;;
    *)
      error "不明なオプション: ${arg}"
      echo "ヘルプ: $0 --help"
      exit 1
      ;;
  esac
done

# ------------------------------------------------------------------------------
# 開始メッセージ
# ------------------------------------------------------------------------------
echo ""
echo "=============================================="
echo " ProjectHub デプロイ開始"
echo "=============================================="
info "接続先: ${SERVER}"
info "リモートディレクトリ: ${REMOTE_APP_DIR}"
info "API URL: ${VITE_API_URL}"
if [[ "${SKIP_BUILD}" == "true" ]]; then warn "ビルドはスキップされます"; fi
if [[ "${SKIP_MIGRATE}" == "true" ]]; then warn "DB マイグレーションはスキップされます"; fi
echo ""

# ------------------------------------------------------------------------------
# SSH 鍵のパーミッション確認・接続テスト
# ------------------------------------------------------------------------------
if [[ ! -f "${SSH_KEY_PATH}" ]]; then
  error "SSH 鍵ファイルが見つかりません: ${SSH_KEY_PATH}"
  error "deploy.conf の SSH_KEY を確認してください"
  exit 1
fi
chmod 400 "${SSH_KEY_PATH}"

info "SSH 接続を確認中..."
if ! ssh "${SSH_OPTS[@]}" "${SERVER}" 'echo connected' &>/dev/null; then
  error "SSH 接続に失敗しました"
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
echo -e " ${GREEN}デプロイ完了${NC}"
echo "=============================================="
if [[ "${DEPLOY_FRONTEND}" == "true" ]]; then
  info "フロントエンド: ${VITE_API_URL%/api}"
fi
if [[ "${DEPLOY_BACKEND}" == "true" ]]; then
  info "バックエンドログ確認: ssh -i ${SSH_KEY_PATH} ${SERVER} 'pm2 logs ${PM2_APP_NAME} --lines 30'"
fi
echo ""
