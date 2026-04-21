# Backend ドキュメント

Node.js + Express + Prisma による REST API サーバーの仕様です。  
仕様駆動開発では **API 契約** と **データモデル** をここで定義・参照します。

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [SPEC_OVERVIEW.md](SPEC_OVERVIEW.md) | アーキテクチャ、技術スタック、認証、環境 |
| [API_SPEC.md](API_SPEC.md) | エンドポイント一覧（メソッド・パス・概要） |
| [DATA_MODEL.md](DATA_MODEL.md) | Prisma スキーマに基づくエンティティ概要 |

## 関連リポジトリパス

- ソース: `backend/src/`
- ルート: `backend/src/routes/*.ts`
- スキーマ: `backend/prisma/schema.prisma`
- ワンタイム移行ツール: `backend/migration/legacy-crm/`（入力JSONは `backend/migration/legacy-crm/input/`）。`users.json` から `User` を取り込み、初期パスワードはログイン用メールアドレスの **@ より前**（`bcrypt` ハッシュで保存）。`activity_histories` → `Activity` では旧 `reason` を活動種別（`type`）にマッピングし、`detail` 内の `動機：` を件名に反映する。手順・マッピング・オプションは同フォルダの `README.md` を参照。
