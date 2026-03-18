# Frontend ドキュメント

React + Vite による Web フロントエンドの仕様です。  
仕様駆動開発では **画面・ルート** と **型・API 利用** をここで定義・参照します。

## ドキュメント一覧

| ファイル | 内容 |
|----------|------|
| [SPEC_OVERVIEW.md](SPEC_OVERVIEW.md) | アーキテクチャ、技術スタック、認証フロー |
| [SCREENS_AND_ROUTES.md](SCREENS_AND_ROUTES.md) | 画面一覧、URL ルート、表示条件 |
| [DATA_MODELS.md](DATA_MODELS.md) | TypeScript 型定義（`types/index.ts`）の概要 |
| [API_USAGE.md](API_USAGE.md) | API クライアント（axios）、認証ヘッダー、利用方針 |

## 関連リポジトリパス

- エントリ: `frontend/src/main.tsx`, `App.tsx`
- ページ: `frontend/src/pages/*.tsx`
- 型: `frontend/src/types/index.ts`
- API: `frontend/src/api/client.ts`
