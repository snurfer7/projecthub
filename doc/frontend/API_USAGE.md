# Frontend API 利用仕様

## クライアント

- **ファイル**: `frontend/src/api/client.ts`
- **実体**: axios インスタンス。`baseURL: '/api'`（Vite の proxy でバックエンドへ転送する想定）。
- **認証**: リクエストインターセプターで `localStorage.getItem('token')` を取得し、`Authorization: Bearer <token>` を付与。
- **401 処理**: レスポンスインターセプターで 401 の場合、`localStorage` から token/user を削除し、`window.location.href = '/login'` でログイン画面へ遷移。

## 利用方針

- 各ページ・コンポーネントで `import api from '@/api/client'`（または相対パス）し、`api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()` でエンドポイントを呼ぶ。
- レスポンス型は `frontend/src/types/index.ts` の型と一致させる。必要に応じて `include` パラメータや API 仕様に合わせて部分型を定義してよい。
- エラー時は `error.response?.data?.error` でメッセージを取得し、UI に表示する。

## エンドポイントとの対応

- バックエンドの [API_SPEC.md](../backend/API_SPEC.md) を契約とする。パスは `client` の baseURL が `/api` のため、`api.get('auth/me')` は `GET /api/auth/me` に相当。
- ファイルアップロードは `FormData` で `api.post('attachments/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })` のように呼ぶ。

## 開発時のプロキシ

Vite で `/api` をバックエンド（例: `http://localhost:3000`）にプロキシする設定を推奨。`vite.config.ts` の `server.proxy` で `/api` → バックエンド URL に転送する。
