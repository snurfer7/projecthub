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
- 企業一覧ページは `api.get('companies', { params: { page, pageSize, q } })` でページング応答（`items`, `total`, …）を取得する。ドロップダウン用など全件が必要な箇所は `page` なしで配列を取得する。
- 企業統合は `api.post('companies/' + sourceId + '/merge', { targetCompanyId })` のように POST `/companies/:id/merge` を呼ぶ（成功時は統合先の企業詳細へ遷移する）。契約は `API_SPEC.md` の当該エンドポイントを参照。
- ファイルアップロードは `FormData` で `api.post('attachments/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })` のように呼ぶ。
- 管理画面のメール設定は `GET/PUT admin/settings/email`、`POST admin/settings/email/test`（Body: `toEmail`）を使用する。SMTP パスワードは PUT でのみ送り、GET では `smtpPasswordSet` のみ参照する。
- 活動履歴からファイルを付ける場合は、活動保存後に `api.post('companies/:companyId/comments', { sourceActivityId })` でファイル用コメントを紐づけ、続けて `companyCommentId` 付きでアップロードする。一覧・編集では `GET /crm/activities?companyId=...` の `fileComment.attachments` を使い、`attachments/token/:id` と `attachments/file/:id?downloadToken=` でダウンロード、`DELETE attachments/:id` で削除する（コメントタブの添付一覧とも同期）。活動削除は `api.delete('crm/activities/:id', { params: { deleteLinkedComment: 'true' | 'false' } })` — ファイル用コメントがあるとき `true` でコメント・添付も削除、`false` で活動のみ削除（未指定は API 仕様どおりコメントは残す）。コメント一覧から活動への強調表示は `?tab=activities&activity=<id>` を利用する。

## 開発時のプロキシ

Vite で `/api` をバックエンド（例: `http://localhost:3000`）にプロキシする設定を推奨。`vite.config.ts` の `server.proxy` で `/api` → バックエンド URL に転送する。
