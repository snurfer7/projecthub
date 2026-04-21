# ProjectHub ドキュメント

本フォルダは **仕様駆動開発** に必要なドキュメントを格納します。  
フロントエンド・バックエンド・Android ごとに仕様を整理し、実装と仕様の乖離を防ぎ、受け入れ条件の明確化に利用します。

**Agent 駆動時のルール**（`.cursor/rules/doc-driven-development.mdc`）: 実装時は本 doc を参照してから実装し、仕様変更時は **ドキュメントを先に更新してから実装** すること。

## ドキュメント構成

| ディレクトリ | 対象 | 主な内容 |
|-------------|------|----------|
| [frontend/](frontend/) | Web フロントエンド (React + Vite) | 画面・ルート仕様、型定義、API 利用仕様 |
| [backend/](backend/) | API サーバー (Node.js + Express + Prisma) | API 仕様、データモデル、認証 |
| [android/](android/) | Android アプリ (Kotlin + Jetpack Compose) | 画面・ナビゲーション、API 連携 |

## 仕様駆動開発での利用

- **要件・仕様の参照**: 新機能追加・変更時に各領域の `SPEC_OVERVIEW.md` で概要を確認する。
- **API 契約**: バックエンドの `API_SPEC.md` を API 契約として共有し、フロント・Android はこれに従う。
- **画面・フロー**: フロントは `SCREENS_AND_ROUTES.md`、Android は `SCREENS_AND_NAVIGATION.md` で画面一覧と遷移を確認する。
- **データモデル**: バックエンドの Prisma スキーマ（`backend/prisma/schema.prisma`）を正とする。フロント・Android の型は `DATA_MODEL.md` と整合させる。

## その他のドキュメント

- [LIGHTSAIL_DEPLOYMENT.md](LIGHTSAIL_DEPLOYMENT.md) — AWS Lightsail へのデプロイ手順（Frontend / Backend / PostgreSQL）
