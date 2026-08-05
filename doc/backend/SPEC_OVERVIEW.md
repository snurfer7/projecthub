# Backend 仕様概要

## 目的

プロジェクト管理・時間追跡・ガントチャート・CRM 機能を提供する REST API サーバー。  
PostgreSQL + Prisma で永続化し、JWT で認証する。

## 技術スタック

| 項目 | 技術 |
|------|------|
| ランタイム | Node.js |
| フレームワーク | Express |
| ORM | Prisma |
| DB | PostgreSQL |
| 認証 | JWT (Bearer)。任意で Microsoft Entra ID（Microsoft 365）OIDC SSO |
| ファイルストレージ | ローカル / S3 互換 (MinIO) |

## アーキテクチャ

- **エントリ**: `backend/src/index.ts`
- **ルート**: `backend/src/routes/*.ts` を `/api/<prefix>` でマウント
- **認証**: `backend/src/middleware/auth.ts` の `authenticateToken` を必要なルートに適用
- **エラーハンドリング**: `backend/src/middleware/error.ts`

### ルートプレフィックス一覧

| プレフィックス | ファイル | 主な機能 |
|----------------|----------|----------|
| `/api/auth` | auth.ts | ログイン・登録・me・パスワード・ランディング・メニュー設定・認証方式・Microsoft SSO |
| `/api/projects` | projects.ts | プロジェクト CRUD、メンバー・グループ・コメント |
| `/api/issues` | issues.ts | チケット CRUD、コメント、関連、メタ（tracker/status/priority） |
| `/api/wiki` | wiki.ts | プロジェクト Wiki の CRUD・移動 |
| `/api/attachments` | attachments.ts | アップロード・ダウンロード・削除 |
| `/api/time-entries` | timeEntries.ts | 工数 CRUD |
| `/api/admin` | admin.ts | ユーザー・tracker/status/priority/group/role・設定は管理者のみ。会社・法人区分・団体の CRUD および GET /users は認証済みユーザーで利用可能 |
| `/api/gantt` | gantt.ts | ガント用データ（プロジェクト単位・全体） |
| `/api/companies` | companies.ts | 会社の CRUD・コメント・Wiki・拠点・団体紐付け（認証済みユーザーで利用可能） |
| `/api/crm` | crm.ts | コンタクト・ Deal・Activity CRUD、コメント |
| `/api/home` | home.ts | ホームページコンテンツ |

## 認証・権限

- **パスワードログイン**: `POST /api/auth/login` — `email`, `password` → `token`, `user`。ユーザーの `authMethod` が `sso` のときは拒否
- **Microsoft SSO（Web）**: Entra ID OIDC（Authorization Code + PKCE）。`GET /api/auth/microsoft/start` → callback → ワンタイム code → `POST /api/auth/microsoft/exchange`。紐付け主キーは `microsoftOid`（メール不一致時は明示連携が必要。自動プロビジョニングなし）
- **認証方式**: 個人設定で `password` \| `sso` の二択（`PUT /api/auth/auth-method`）。SSO 利用前に Microsoft アカウント連携が必要
- **登録**: `POST /api/auth/register` — `email`, `password`, `firstName`, `lastName` → `token`, `user`
- **認証が必要なリクエスト**: ヘッダー `Authorization: Bearer <token>`
- **トークン取得**: `auth.ts` 内の `generateToken(userId, role, isAdmin)`（JWT、要 `JWT_SECRET` 環境変数、有効期限 7 日）
- **トークン無効・期限切れ**: `authenticateToken` が **401** を返す。フロント／Android は 401 でログイン画面へ遷移する（権限不足の 403 とは区別）
- **権限制御**: 二層。(1) ユーザー → Group → PermissionSet（`scope=group`、例: `projects`）。(2) プロジェクト内 Role → RolePermission（`scope=role`、例: `projects.issues`）。`GET /api/auth/me` はグループ権限のみ。プロジェクト詳細は `GET /api/projects/:id` の `myPermissions`。**isAdmin / role=admin でもバイパスしない**。
- **使用可否 (`canUse`)**: 閲覧・GET API・画面アクセス
- **入力可否 (`canInput`)**: 作成・更新・削除・POST/PUT/DELETE API（canUse が true のときのみ有効）。親の canInput は子（field）の canInput からは推定しない（機能単位の明示設定のみ）

### 新機能・項目追加時の権限実装

[doc/README.md](../README.md) の「権限設定を伴う実装（必須）」に従う。実装の正:

| レイヤ | ファイル |
|--------|---------|
| カタログ定義 | `backend/src/constants/permissionCatalog.ts`（`scope: group \| role`） |
| seed | `backend/prisma/seed-permissions.ts` |
| 起動時カタログ同期 | `backend/src/services/syncPermissionCatalog.ts` |
| グループ API ガード | `backend/src/middleware/permissions.ts`（`requirePermission`） |
| ロール／プロジェクト API ガード | `backend/src/services/projectPermissions.ts`（`requireProjectPermission`） |
| 解決・フィールド検証 | `backend/src/services/permissions.ts` |
| フロント | `frontend/src/hooks/usePermissions.ts`, `PermissionGate`, `PermissionRoute`, プロジェクトは `myPermissions` |

- **初期構築（seed）**: PermissionSet が0件のときのみ「全権限」権限セットと「デフォルト」グループを作成し、既存ユーザーをデフォルトへ所属させる。
- **起動時同期**: `PermissionResource` のカタログ同期のみ。既存の「全権限」があれば新規リソースを全許可で追記する。グループの作成・メンバー割当は行わない。

新 API を追加したら、同 PR で `requirePermission('<code>', 'use' \| 'input')` を必ず付ける。

## 環境変数（代表）

- `DATABASE_URL`: PostgreSQL 接続文字列
- `JWT_SECRET`: JWT 署名用シークレット
- `UPLOAD_DIR`: アップロードファイル保存先（省略時は `../../uploads`）
- S3 利用時: `AWS_*`, `S3_BUCKET_NAME` 等（`backend/src/services/s3.ts` 参照）
- Microsoft SSO: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, `FRONTEND_URL`（`FRONTEND_URL` はユーザー作成時の案内メールに記載するログイン URL の基点にも使用。未設定時は `http://localhost:5173`）

## ヘルスチェック

- `GET /api/health` → `{ "status": "ok" }`（認証不要）
