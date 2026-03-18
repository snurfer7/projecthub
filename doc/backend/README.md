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
- スキーマ: `prisma/schema.prisma`
