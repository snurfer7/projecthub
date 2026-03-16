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
| 認証 | JWT (Bearer) |
| ファイルストレージ | ローカル / S3 互換 (MinIO) |

## アーキテクチャ

- **エントリ**: `backend/src/index.ts`
- **ルート**: `backend/src/routes/*.ts` を `/api/<prefix>` でマウント
- **認証**: `backend/src/middleware/auth.ts` の `authenticateToken` を必要なルートに適用
- **エラーハンドリング**: `backend/src/middleware/error.ts`

### ルートプレフィックス一覧

| プレフィックス | ファイル | 主な機能 |
|----------------|----------|----------|
| `/api/auth` | auth.ts | ログイン・登録・me・パスワード・ランディング・メニュー設定 |
| `/api/projects` | projects.ts | プロジェクト CRUD、メンバー・グループ・コメント |
| `/api/issues` | issues.ts | チケット CRUD、コメント、関連、メタ（tracker/status/priority） |
| `/api/wiki` | wiki.ts | プロジェクト Wiki の CRUD・移動 |
| `/api/attachments` | attachments.ts | アップロード・ダウンロード・削除 |
| `/api/time-entries` | timeEntries.ts | 工数 CRUD |
| `/api/admin` | admin.ts | ユーザー・tracker/status/priority/group/role・会社・法人区分・団体・設定（管理者向け） |
| `/api/gantt` | gantt.ts | ガント用データ（プロジェクト単位・全体） |
| `/api/companies` | companies.ts | 会社のコメント・Wiki・拠点・団体紐付け |
| `/api/crm` | crm.ts | コンタクト・ Deal・Activity CRUD、コメント |
| `/api/home` | home.ts | ホームページコンテンツ |

## 認証

- **ログイン**: `POST /api/auth/login` — `email`, `password` → `token`, `user`
- **登録**: `POST /api/auth/register` — `email`, `password`, `firstName`, `lastName` → `token`, `user`
- **認証が必要なリクエスト**: ヘッダー `Authorization: Bearer <token>`
- **トークン取得**: `auth.ts` 内の `generateToken(userId, role, isAdmin)`（JWT、要 `JWT_SECRET` 環境変数）

## 環境変数（代表）

- `DATABASE_URL`: PostgreSQL 接続文字列
- `JWT_SECRET`: JWT 署名用シークレット
- `UPLOAD_DIR`: アップロードファイル保存先（省略時は `../../uploads`）
- S3 利用時: `AWS_*`, `S3_BUCKET_NAME` 等（`backend/src/services/s3.ts` 参照）

## ヘルスチェック

- `GET /api/health` → `{ "status": "ok" }`（認証不要）
