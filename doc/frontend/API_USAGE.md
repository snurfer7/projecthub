# Frontend API 利用仕様

## クライアント

- **ファイル**: `frontend/src/api/client.ts`
- **実体**: axios インスタンス。`baseURL: '/api'`（Vite の proxy でバックエンドへ転送する想定）。
- **認証**: リクエストインターセプターで `localStorage.getItem('token')` を取得し、`Authorization: Bearer <token>` を付与。
- **401 処理**: レスポンスインターセプターで 401 の場合（トークン未付与・無効・期限切れを含む）、`localStorage` から token/user を削除し、`window.location.href = '/login'` でログイン画面へ遷移。ただし `auth/login` および `auth/microsoft/exchange` の 401 は画面側でエラー表示するためリダイレクトしない。権限不足の 403 ではリダイレクトしない。
- **Microsoft SSO**: ログインは `/api/auth/microsoft/start` へ遷移 → コールバック後 `/login?ssoCode=` → `POST /auth/microsoft/exchange`。設定からの連携は `GET /auth/microsoft/link/start` の `authorizationUrl` へ遷移。認証方式は `PUT /auth/auth-method`。

## 権限チェック

- **フック**: `frontend/src/hooks/usePermissions.ts` — `canUse(code)`, `canInput(code)` を提供。`useAuth` が `/auth/me` の `permissions` を保持。
- **トークン差し替え**: `useAuth` は `/auth/me` の応答に `token` があれば `localStorage` のトークンを差し替える（`role` / `isAdmin` の変更を反映するため）。`token` は `user` オブジェクトには保存しない。
- **コンポーネント**: `PermissionGate` — 子要素の表示/非表示・readOnly 切替。
- **権限設定管理**: `GET admin/permissions/resources`, `GET/POST/PUT/DELETE admin/permission-sets`（Body に `groupIds`, `permissions`）。

- **権限チェック**: `usePermissions` の `canUse` / `canInput`。新画面・新ボタン・新フィールド追加時は [doc/README.md](../README.md) の権限チェックリストに従い、同一変更で反映する。

## 利用方針

- 各ページ・コンポーネントで `import api from '@/api/client'`（または相対パス）し、`api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()` でエンドポイントを呼ぶ。
- レスポンス型は `frontend/src/types/index.ts` の型と一致させる。必要に応じて `include` パラメータや API 仕様に合わせて部分型を定義してよい。
- エラー時は `error.response?.data?.error` でメッセージを取得し、UI に表示する。
- **プロジェクトメンバー可視性**: `GET projects` / `gantt/all` / `issues` / `time-entries` / `time-tree` 等は、個別メンバーまたは割当グループのカバレッジ（子孫所属含む）で見えるプロジェクトのみ返す（`isAdmin` は全件）。詳細で非メンバーは 403。`GET projects/:id` の `members` は個別割当、`groups` は `roleIds` と実効メンバー（展開済み）。グループへの後からの所属は再割当なしで一覧に出る。個別／グループとも 0 件になる解除時は API が操作ユーザーを個別メンバーとして自動追加する。
- **プロジェクトロール権限**: `GET projects/:id` の `myPermissions` でプロジェクト詳細機能・項目を制御。グループの PermissionSet はトップレベル `projects` のみ。管理 > ロールでプロジェクト権限マトリクスを編集。システム管理者は `projects.members` のみ RolePermission をバイパス（メンバー選択 UI が常に利用可能）。一覧系 API（`GET projects` / `gantt/all` / `issues` / `time-entries` / `time-tree`）もシステム管理者はロール権限で絞り込まれない。
- **チケットステータス／ワークフロー**: `GET issues/meta/options?projectId=` の `workflow`（`assignableStatusIds` / `allowedTransitions`）で作成・編集の選択肢とカンバン移動を制限。API の POST/PUT でも検証する。プロジェクト一覧の**時間**タブは `GET /time-tree` の `workflowByProjectId` を用い、チケット行から `PUT /issues/:id`（`statusId` / `doneRatio`）で一覧更新し、同様にワークフローと field 権限を適用する（成功時はローカル更新し全件再取得しない）。

## エンドポイントとの対応

- バックエンドの [API_SPEC.md](../backend/API_SPEC.md) を契約とする。パスは `client` の baseURL が `/api` のため、`api.get('auth/me')` は `GET /api/auth/me` に相当。
- 企業一覧ページは `api.get('companies', { params: { page, pageSize, q } })` でページング応答（`items`, `total`, …）を取得する。ドロップダウン用など全件が必要な箇所は `page` なしで配列を取得する。
- 連絡先一覧ページは `api.get('crm/contacts', { params: { page, pageSize, q } })` でページング応答を取得する。企業別の連絡先タブは `page` なしで `api.get('crm/contacts', { params: { companyId } })` を使用する（配列）。CSV 出力時は一覧と同じ `q` を付け、`pageSize=100` で一致する全ページを取得し、拠点の郵便番号・住所を含む列を出力する。
- 企業統合は `api.post('companies/' + sourceId + '/merge', { targetCompanyId })` のように POST `/companies/:id/merge` を呼ぶ（成功時は統合先の企業詳細へ遷移する）。契約は `API_SPEC.md` の当該エンドポイントを参照。
- ファイルアップロードは `FormData` で `api.post('attachments/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })` のように呼ぶ。
- 管理画面のメール設定は `GET/PUT admin/settings/email`、`POST admin/settings/email/test`（Body: `toEmail`）を使用する。SMTP パスワードは PUT でのみ送り、GET では `smtpPasswordSet` のみ参照する。
- 管理画面の休日設定は `GET/PUT admin/settings/holidays`（Body/応答: `holidayWeekdays`, `holidays`, `workdays`）。国民の祝日データはフロントから `https://holidays-jp.github.io/api/v1/date.json` を直接取得し、モーダルで年選択後に既存 `holidays` へマージして PUT する。
- ガント等での営業時間・休日の参照は `GET settings/calendar`（認証のみ。時間設定＋休日設定をまとめて返す）。
- ガントデータ（`GET gantt/project/:id` / `GET gantt/all`）の各チケットには `actualHours`（時間記録の hours 合計）が含まれる。左ペイン列の実工数表示に利用する。
- **チケット／ガントの担当者絞り込み（サーバー側）**: プロジェクト一覧のガント・カンバンはトラッカー／ステータス／担当者条件を `GET issues` または `GET gantt/*` の Query に渡して取得する。時間タブは `GET /time-tree` に同趣旨の Query を渡す（記録期間・記録者変更時は `include=entries` で時間記録のみ再取得）。`assignedToIds` と `assignedToGroupIds` は **OR**（ユーザー担当一致または担当グループ一致）。「未割当」を含む場合は担当者 Query を付けず、クライアントの `matchesIssueFilter` で OR 判定する。期日・開始終了期間など日付系は従来どおりクライアント側。時間記録の記録者は `userIds` と `userGroupIds`（グループ所属メンバーへサーバー展開）で絞り込む。
- ガント左ペイン列の表示・順序・幅は `PUT /auth/ui-preferences`（Body `{ uiPreferences: { gantt: { columns } } }`）で保存し、`GET /auth/me` の `uiPreferences` から復元する（ログインユーザー自身の設定。PermissionSet 不要）。
- 仮登録ユーザーへの登録メール再送は `api.post('admin/users/' + id + '/resend-registration-email')`（権限 `admin.users` input。成功時は仮パスワード更新済み）。
- 活動履歴からファイルを付ける場合は、活動保存後に `api.post('companies/:companyId/comments', { sourceActivityId })` でファイル用コメントを紐づけ、続けて `companyCommentId` 付きでアップロードする。一覧・編集では `GET /crm/activities?companyId=...` の `fileComment.attachments` を使い、`attachments/token/:id` と `attachments/file/:id?downloadToken=` でダウンロード、`DELETE attachments/:id` で削除する（コメントタブの添付一覧とも同期）。活動削除は `api.delete('crm/activities/:id', { params: { deleteLinkedComment: 'true' | 'false' } })` — ファイル用コメントがあるとき `true` でコメント・添付も削除、`false` で活動のみ削除（未指定は API 仕様どおりコメントは残す）。コメント一覧から活動への強調表示は `?tab=activities&activity=<id>` を利用する。企業活動の作成・更新でプロジェクトを複数紐づける場合は Body に `projectIds: number[]`。活動の拠点は Body に `locationId`（当該企業の拠点。field 権限 `companies.activities.fields.location`）。プロジェクト活動履歴タブからの既存活動の紐づけは `api.post('projects/:id/activities', { activityId })`、解除は `api.delete('projects/:id/activities/:activityId')`（権限 `companies.activities` input）。一覧は `api.get('projects/:id/activities')`。プロジェクト側からの活動の新規作成は行わない。活動履歴からのプロジェクト半自動作成は `api.post('projects', { name, identifier, companyId, contactId, locationId, parentId, dueDate, description, sourceActivityId })`（権限 `projects` input）。モーダル初期値は活動の件名・詳細・期限・企業・拠点・先方担当者を引き継ぐ。`sourceActivityId` 指定時は作成と同時に `ActivityProject` が作られ、活動一覧の再取得でプロジェクトバッジが更新される。

- 保存済み検索条件は `api.get('saved-searches', { params: { viewMode } })` で取得（`SavedSearch[]`）。作成は `api.post('saved-searches', { viewMode, name, filter, isDefault? })`、更新は `api.put('saved-searches/:id', { name?, filter?, isDefault? })`、削除は `api.delete('saved-searches/:id')`。契約は `API_SPEC.md` の `/api/saved-searches` を参照。

## 開発時のプロキシ

Vite で `/api` をバックエンド（例: `http://localhost:3000`）にプロキシする設定を推奨。`vite.config.ts` の `server.proxy` で `/api` → バックエンド URL に転送する。
