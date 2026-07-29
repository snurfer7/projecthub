# Backend API 仕様

Base URL: `/api`（認証が必要なエンドポイントは `Authorization: Bearer <token>` を付与）

---

## Auth — `/api/auth`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| POST | `/login` | 不要 | パスワードログイン。Body: `email`, `password` → `token`, `user`（`status`, `authMethod`, `microsoftLinked` を含む）。`status === 'inactive'` は 401。`authMethod === 'sso'` のユーザーは 401（Microsoft ログインを案内） |
| POST | `/register` | 不要 | 登録。Body: `email`, `password`, `firstName`, `lastName` → `token`, `user` |
| GET | `/me` | 必要 | 現在ユーザー情報（`status`, `authMethod`, `microsoftLinked`, `permissions` を含む）。`permissions` は `Record<string, { canUse: boolean, canInput: boolean }>` |
| PUT | `/password` | 必要 | パスワード変更。Body: `currentPassword`, `newPassword`。`authMethod === 'sso'` のときは 400。`pending` の場合は更新完了時に `active` へ |
| PUT | `/landing-page` | 必要 | ランディング設定。Body: `landingPage` (`home` \| `projects` \| `companies`) |
| PUT | `/menu-settings` | 必要 | メニュー表示。Body: `showProjectsMenu`, `showGanttMenu`, `showCompanyMenu`, `showAdminMenu` |
| PUT | `/auth-method` | 必要 | 認証方式切替。Body: `authMethod`（`password` \| `sso`）, `newPassword`（`password` へ切替時必須）。権限: `settings` use + `settings.fields.authMethod` input。`sso` へは `microsoftOid` 連携済み必須。`sso` 切替時はパスワードを無効化（ランダムハッシュ） |
| GET | `/microsoft/start` | 不要 | Microsoft 365（Entra ID）OIDC ログイン開始。Entra へリダイレクト |
| GET | `/microsoft/callback` | 不要 | OIDC コールバック。成功時はワンタイム `ssoCode` 付きで `FRONTEND_URL/login` へ。失敗時は `ssoError` クエリ付きで同 URL へ。連携フロー成功時は `/settings` へ |
| POST | `/microsoft/exchange` | 不要 | Body: `code`（ワンタイム）。→ `token`, `user`。コードは短命・単回使用 |
| GET | `/microsoft/status` | 不要 | `{ enabled: boolean }`。環境変数が揃っているとき `enabled: true`（ログイン画面のボタン表示用） |
| GET | `/microsoft/link/start` | 必要 | Microsoft アカウント連携開始。権限: `settings` use + `settings.fields.microsoftAccount` input。JSON: `{ authorizationUrl }`（フロントが遷移） |
| POST | `/microsoft/unlink` | 必要 | 連携解除。権限: 同上 input。`authMethod === 'sso'` のときは不可（先に password へ切替） |

### Microsoft SSO 解決ルール（callback・ログイン）

1. `microsoftOid` 一致かつ `authMethod === 'sso'` → ログイン。Entra のログイン ID（UPN = トークンの `preferred_username`。無ければ `email` claim）が現在の `User.email` と異なり、他ユーザー未使用なら `email` をその値に更新。`pending` なら `active` へ
2. 未連携・メール完全一致・`authMethod === 'sso'` → `oid` 保存してログイン
3. それ以外（未登録・メール不一致・`authMethod === 'password'`・他ユーザーに oid 割当済）→ SSO 拒否（自動プロビジョニングなし）

テナントは `MICROSOFT_TENANT_ID` に固定（`common` 不可）。

---

## Projects — `/api/projects`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | プロジェクト一覧 |
| GET | `/:id` | プロジェクト詳細 |
| POST | `/` | プロジェクト作成 |
| PUT | `/:id` | プロジェクト更新 |
| DELETE | `/:id` | プロジェクト削除 |
| POST | `/:id/members` | メンバー追加 |
| PUT | `/:id/members/:memberId` | メンバー・ロール更新 |
| DELETE | `/:id/members/:memberId` | メンバー削除 |
| GET | `/roles/available` | 利用可能ロール一覧 |
| GET | `/:id/groups` | プロジェクト紐付けグループ一覧 |
| POST | `/:id/groups` | グループ紐付け |
| PUT | `/:id/groups/:groupId/role` | グループのロール設定更新 |
| DELETE | `/:id/groups/:groupId` | グループ紐付け解除 |
| GET | `/:id/comments` | コメント一覧 |
| POST | `/:id/comments` | コメント追加 |
| PUT | `/:id/comments/:commentId` | コメント更新 |
| GET | `/:id/activities` | プロジェクトに紐づく活動履歴一覧（N:N）。権限: `projects.activities` use |
| POST | `/:id/activities` | 既存活動をプロジェクトへ紐づけ。Body: `{ activityId }`。権限: `companies.activities` input。活動の企業が当該プロジェクトの主企業または関連企業であること |
| DELETE | `/:id/activities/:activityId` | プロジェクトと活動の紐づけ解除。権限: `companies.activities` input |

---

## Issues — `/api/issues`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | チケット一覧。Query: `projectId`, `statusId` / `statusIds`（複数）, `trackerId` / `trackerIds`（複数）, `priorityId`, `assignedToId` / `assignedToIds`（複数担当者）, `assignedToGroupId`。複数 ID はカンマ区切りまたは配列。応答に `parentId` / `parent` / `_count.children` を含み、子を持つチケットの `startDate` / `endDate` / `statusId`（`status`）は子孫から集約した値（ステータスは position 最小）。`project` は `{ id, name, company: { id, name } \| null }` を含む（カンバン等クロスプロジェクト表示での企業名表示用） |
| GET | `/meta/options` | メタ（trackers, statuses, priorities, users, groups）。Query: `projectId`（任意）。`projectId` 指定時はプロジェクトメンバー・紐付きグループのみ返す。未指定時は全ユーザー・全グループを返す |
| GET | `/:id` | チケット詳細。`parent` / `children`（id, subject, startDate, endDate）を含む。子がある場合 `startDate` / `endDate` / `status` は集約値 |
| POST | `/` | チケット作成。Body に `parentId`（任意・同一プロジェクト・循環不可）。権限: 項目 `projects.issues.fields.parent`（`parentId` 指定時） |
| PUT | `/:id` | チケット更新。Body に `parentId`（任意・null で解除）。子チケットがある場合 `startDate` / `endDate` / `statusId` の更新は 400。権限: `projects.issues.fields.parent` |
| DELETE | `/:id` | チケット削除 |
| PUT | `/reorder` | 順序更新。Body: `issues: [{ id, position }]` |
| POST | `/:id/relations` | 関連追加 |
| DELETE | `/relations/:relationId` | 関連削除 |
| POST | `/:id/comments` | コメント追加 |
| PUT | `/:id/comments/:commentId` | コメント更新 |
| DELETE | `/:id/comments/:commentId` | コメント削除 |

親チケットの開始・終了日時およびステータスは子から導出するため、子があるチケットへの `startDate` / `endDate` / `statusId` 書き込みは拒否する。

---

## Wiki（プロジェクト） — `/api/wiki`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/project/:projectId` | プロジェクトの Wiki 一覧 |
| GET | `/:id` | Wiki ページ詳細（id はページ ID） |
| POST | `/` | ページ作成。Body: `projectId`, `title`, `content`, `parentId`（任意） |
| PUT | `/:id` | ページ更新。Body: `title`, `content`, `parentId` |
| DELETE | `/:id` | ページ削除 |
| PATCH | `/:id/move` | 移動。Body: `parentId`, `position` |

---

## Attachments — `/api/attachments`

| メソッド | パス | 概要 |
|----------|------|------|
| POST | `/upload` | ファイルアップロード（multipart, `file`） |
| POST | `/token/:id` | トークン発行（ダウンロード用） |
| GET | `/download/:id` | ダウンロード（認証 or トークン） |
| GET | `/file/:id` | ファイル取得 |
| DELETE | `/:id` | 削除（認証済み）。会社コメント経由の添付も同一 API で削除し、コメント側の一覧からも消える |

---

## Time Entries — `/api/time-entries`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | 一覧。Query: `projectId`, `issueId`, `startDate`, `endDate`, `userId`（単一・後方互換）, `userIds`（カンマ区切りまたは配列で複数担当者） |
| POST | `/` | 作成。Body: `projectId`, `issueId`（任意）, `hours`, `activity`, `spentOn`, `comments`（任意） |
| PUT | `/:id` | 更新 |
| DELETE | `/:id` | 削除 |

---

## Admin — `/api/admin`

認証必須。各エンドポイントは対応する権限コードの `canUse`（GET）または `canInput`（POST/PUT/DELETE）が必要。`isAdmin` / `role=admin` でもバイパスしない。

### 権限設定 — `/api/admin/permission-sets`

| メソッド | パス | 概要 | 権限 |
|----------|------|------|------|
| GET | `/permissions/resources` | 権限カタログツリー | `admin.permission-sets` use |
| GET | `/permission-sets` | 権限設定一覧（割当グループ名含む） | `admin.permission-sets` use |
| GET | `/permission-sets/:id` | 権限設定詳細 + 権限マトリクス + 割当グループ | `admin.permission-sets` use |
| POST | `/permission-sets` | 作成。Body: `{ name, description?, groupIds?, permissions? }` | `admin.permission-sets` input |
| PUT | `/permission-sets/:id` | 更新。Body: `{ name, description?, groupIds?, permissions? }` | `admin.permission-sets` input |
| DELETE | `/permission-sets/:id` | 削除（紐づく Group の permissionSetId を null に） | `admin.permission-sets` input |

**グループ割当**: `groupIds` 指定時、対象 Group の `permissionSetId` を設定。1 グループ = 1 権限設定。他の PermissionSet から移動する。

### その他 Admin エンドポイント

| メソッド | パス | 概要 | 権限 |
|----------|------|------|------|
| GET | `/users` | ユーザー一覧（担当者選択等） | 認証 |
| POST | `/users` | ユーザー作成（作成時の `status` は常に `pending`。仮パスワードはサーバーで乱数生成し、登録メールアドレスへ案内メールを送信。本文にログイン URL（`FRONTEND_URL`）、メールアドレス、仮パスワードを記載。リクエストの `status` 指定は無視） | 管理者 |
| POST | `/users/:id/resend-registration-email` | 仮登録ユーザーへ登録メールを再送。仮パスワードを再生成し、メール送信成功後に `passwordHash` を更新する。`status !== 'pending'` は 400。メール送信失敗時は 502（パスワードは変更しない） | `admin.users` input |
| PUT | `/users/:id` | ユーザー更新（`status` を含む） | 管理者 |
| DELETE | `/users/:id` | ユーザー削除（`status === 'pending'` のユーザーのみ許可） | 管理者 |
| GET/POST/PUT/DELETE, POST reorder | `/trackers` | トラッカー | 管理者 |
| GET/POST/PUT/DELETE, POST reorder | `/statuses` | チケットステータス | 管理者 |
| GET/POST/PUT/DELETE, POST reorder | `/priorities` | 優先度 | 管理者 |
| GET/GET:id/POST/PUT/DELETE | `/groups` | グループ（`permissionSetId` 割当可） | `admin.groups` |
| GET/POST/PUT/DELETE, POST reorder, GET/PUT transitions | `/roles` | ロール・ワークフロー遷移 | 管理者 |
| GET/GET:id/POST/PUT/DELETE | `/companies` | 会社（一覧・詳細・作成・更新・削除） | 認証 |
| GET/POST/PUT/DELETE, POST reorder | `/legal-entity-statuses` | 法人区分 | 認証 |
| GET/POST/PUT/DELETE | `/associations` | 団体 | 認証 |
| POST/DELETE | `/companies/:id/associations/:associationId` | 会社-団体紐付け | 認証 |
| GET/PUT | `/settings/time` | 時間設定（管理時間・換算時間） | 管理者 |
| GET/PUT | `/settings/email` | メール送信設定（SES API / SMTP の切替、送信元、SMTP 接続情報）。SMTP パスワードは保存時にサーバー側で暗号化され、GET では `smtpPasswordSet` のみ返す | 管理者 |
| POST | `/settings/email/test` | テストメール送信。Body: `toEmail`（保存済み設定で 1 通送信） | 管理者 |

**メール設定（`/settings/email`）**

- **`emailTransport`**: `ses`（従来どおり AWS SDK の SES `SendEmail`）または `smtp`（SMTP 経由。Amazon SES の SMTP エンドポイント等）。
- **`emailFromOverride`**: 空でない場合、環境変数 `EMAIL_FROM` より優先して送信元に使う。空文字でクリア。
- **SMTP 時の必須**: `smtpHost`, `smtpUser`。初回またはパスワード未保存時は `smtpPassword` が必須。以降の更新でパスワードを変えない場合は `smtpPassword` を送らない（または空）。
- **暗号化キー**: SMTP パスワードは `EMAIL_ENCRYPTION_KEY`（64 文字 hex 推奨）または未設定時は `JWT_SECRET` から導出したキーで AES-256-GCM 暗号化して DB に保存する。

---

## Saved Searches — `/api/saved-searches`

認証必須。操作は常にログイン中ユーザーのデータのみ対象。

| メソッド | パス | 概要 | 権限 |
|----------|------|------|------|
| GET | `/` | 一覧。Query: `viewMode`（必須: `list` \| `gantt` \| `kanban` \| `time`）| 認証のみ |
| POST | `/` | 作成。Body: `{ viewMode, name, filter, isDefault? }` | 認証のみ |
| PUT | `/:id` | 更新。Body: `{ name?, filter?, isDefault? }` | 認証のみ（他ユーザーのデータは 404） |
| DELETE | `/:id` | 削除 | 認証のみ（他ユーザーのデータは 404） |

**isDefault の挙動**: `isDefault: true` で作成・更新した場合、同一ユーザー × 同一 viewMode の他の保存済み検索条件の `isDefault` を自動的に `false` に更新する。

**レスポンス形状**（SavedSearch オブジェクト）:
```json
{
  "id": 1,
  "userId": 2,
  "viewMode": "list",
  "name": "有効プロジェクトのみ",
  "isDefault": true,
  "filter": { "projectFilter": { ... }, "issueFilter": { ... }, "listSort": [{ "key": "name", "direction": "asc" }] },
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## Gantt — `/api/gantt`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/project/:projectId` | 指定プロジェクトのガント用データ。チケットに `parentId` を含み、親の開始・終了は子孫から集約。`startDate` / `endDate` / `dueDate` がすべて未設定のチケットも含む |
| GET | `/all` | 有効（`active`）プロジェクトのガント用データ（同上。日付未設定チケットも含む）。`projects` は `company: { id, name }` を含む（ガントのプロジェクト行で企業名を表示するため） |

---

## Companies — `/api/companies`

認証必須。会社の CRUD およびコメント・Wiki・拠点・団体紐付けは認証済みユーザーで利用可能。

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | 会社一覧（下記クエリでページング／検索。クエリなしのときは従来どおり全件を配列で返す） |
| GET | `/:id` | 会社詳細 |

**GET `/` クエリ（任意・組み合わせ可）**

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `page` | 整数 ≥ 1 | 指定時は **ページング応答**（オブジェクト）。未指定時は全件配列。 |
| `pageSize` | 整数 1〜100 | 1 ページあたり件数。省略時は `50`。 |
| `q` | 文字列 | 企業名（部分一致・大文字小文字無視）またはいずれかの拠点の電話・FAX・郵便番号・住所（都道府県・市区町村・番地・建物）にマッチする企業に絞り込み。 |

**ページング時のレスポンス**（`page` 指定時）

```json
{
  "items": [ /* Company（legalEntityStatus, locations, _count を含む。contacts は含めない） */ ],
  "total": 123,
  "page": 1,
  "pageSize": 50,
  "totalPages": 3
}
```

**全件時**（`page` 未指定）: `Company[]` の JSON 配列（従来どおり。ドロップダウン等用。`locations`, `contacts`, `_count` を含む）。
| POST | `/` | 会社作成 |
| PUT | `/:id` | 会社更新 |
| DELETE | `/:id` | 会社削除 |
| POST | `/:id/merge` | 企業統合。Body: `targetCompanyId`（数値・必須）。**統合元**はパスの `:id`、**統合先**は `targetCompanyId`。統合元に紐づく拠点・連絡先・商談・活動・会社コメント・会社 Wiki・団体紐付け・主契約プロジェクト・プロジェクト関連会社の `company_id` を統合先 ID に更新し、統合元の企業レコードを削除する。**拠点**は付け替えの際、拠点名の末尾に統合元の企業名を括弧付きで追記する（例: `本社` → `本社（統合元の企業名）`）。**備考（`notes`）**は統合元に内容があるとき、統合先の備考の末尾へ空行を挟んで追記する（統合先のみ・統合元のみのどちらか一方でも可）。団体紐付けは統合先に同一団体が既にある行は統合元側を削除（重複解消）。会社 Wiki は統合先とタイトルが重複するページのみ、統合実行前にタイトルへ `（統合:<ページID>）` を付与して一意化する。**200** で `{ mergedIntoId, message }`。**400**（同一 ID・必須欠如・不正 ID）、**404**（いずれかの企業が存在しない） |
| POST | `/:companyId/associations/:associationId` | 団体紐付け |
| DELETE | `/:companyId/associations/:associationId` | 団体紐付け解除 |
| GET/POST/PUT/DELETE | `/:companyId/comments`, `/:companyId/comments/:commentId` | コメント。GET の各要素に `linkedActivity`（`{ id, subject }` または `null`）— 当該コメントが活動のファイル用コメントとして紐づいている場合に活動を示す。POST Body: `content`（文字列。**`sourceActivityId` 未指定時は必須**）。`sourceActivityId`（数値、任意）— 指定時は当該企業に属する活動に、ファイル用コメントを 1 件紐づける（`content` 省略時は自動文面）。既に活動に `fileCommentId` がある場合は既存コメントを返す（**201** 新規 / **200** 既存） |
| GET | `/:companyId/wiki` | 会社 Wiki 一覧 |
| GET/PUT/DELETE | `/:companyId/wiki/:title` | 会社 Wiki ページ（title 指定） |
| PATCH | `/:companyId/wiki/:title/move` | 会社 Wiki 移動 |
| GET/POST/PUT/DELETE | `/:companyId/locations`, `/:companyId/locations/:locationId` | 拠点 |

**POST `/`（会社作成）**

- 成功: **201**、作成された `Company`（初期拠点「本社」は別テーブルで作成されるが、本レスポンスには含まれない）
- **400**: 企業名未入力・`{ "error": "企業名は必須です" }`、法人格 ID が DB に存在しない（`{ "error": "法人格の指定が無効です。…" }`）、送信形式不正
- **409**: 企業名の一意制約違反（既に同名）— `{ "error": "同じ企業名が既に登録されています" }` など
- **500**: 上記以外。DB マイグレーション未適用（カラム不足）時はメッセージで案内する場合あり

---

## CRM — `/api/crm`

| メソッド | パス | 概要 |
|----------|------|------|
| GET/POST/PUT/DELETE | `/contacts`, `/contacts/:id` | コンタクト。**GET `/contacts`**: Query `companyId`（任意）— 企業別絞り込み。Query `page` あり — ページング応答 `{ items, total, page, pageSize, totalPages }`。Query `q`（任意）— 氏名・企業名・備考・連絡先詳細（所属・役職・電話・メール・拠点名）の部分一致（大文字小文字無視）。`page` なし — 配列（ドロップダウン・企業詳細タブ用） |
| GET/POST/PUT/DELETE | `/contacts/:id/comments`, `/:commentId` | コンタクトコメント |
| GET/POST/PUT/DELETE | `/deals`, `/deals/:id` | 商談。**GET `/deals`**: 権限 `deals` use。Query `companyId`（任意）・`status`（任意）・`assignedToId`（任意）・`page`（任意）— ページング応答 `{ items, total, page, pageSize, totalPages }`。Query `q`（任意）— 商談名・企業名の部分一致。`page` なし — 配列（企業詳細タブ用）。**DELETE**: 権限 `companies.deals` input |
| GET/POST/PUT/DELETE | `/activities`, `/activities/:id` | アクティビティ。権限: GET は `companies.activities` use、POST/PUT/DELETE は `companies.activities` input。`assignedToId` は**自社担当者**（User）。`contactId` は**先方担当者**（当該企業の連絡先 Contact を選択、任意）。**`projectIds`**（任意・配列）— 紐づくプロジェクト ID の一覧。POST/PUT で指定時は中間テーブルをその集合に同期（空配列で全解除）。各 ID について活動の `companyId` がそのプロジェクトの主企業または関連企業であること（不一致時 400）。**PUT は部分更新可**（`projectIds` 未指定時は既存紐づけを変更しない）。レスポンスは `assignedTo`・`contact`・**`projects`**（`{ id, name, identifier }[]`）を含む。`fileCommentId` / `fileComment` は従来どおり。**GET `/activities`**: Query `projectId`（任意）— 当該プロジェクトに紐づく活動に絞り込み。プロジェクト画面からは `GET/POST/DELETE /api/projects/:id/activities` も利用可。**DELETE `/activities/:id`**: Query `deleteLinkedComment` — `true` / `1` で紐づくファイル用会社コメントも削除（添付はカスケード）。`false` / `0` または未指定は活動のみ削除しコメントは残す |

**Activity.type（活動種別の標準値）**: `call`（電話）, `email`（メール）, `visit`（訪問）, `meeting`（会議）, `memo`（メモ）, `lead`（引合）, `estimate`（見積り）, `inquiry`（問合せ）, `maintenance`（メンテ）, `claim`（クレーム）。フィールドは文字列のため、上記以外の値も保存され得る（レガシー移行データ等）。

**活動のファイルと会社コメント**

- ストレージ上は **会社コメント** 1 件に `attachments` を紐づける（`POST /api/attachments/upload` の `companyCommentId`）。UI では活動一覧・活動編集から直接ダウンロード・削除できる。`DELETE /api/attachments/:id` でファイルを消すと、会社コメント側の添付一覧からも消える（同一レコード）。
- ファイル用コメントの紐づけは `POST /api/companies/:companyId/comments` の Body に `sourceActivityId` を指定（下記 Companies）。既に当該活動に `fileCommentId` がある場合は既存コメントを返す。

---

## Home — `/api/home`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | ホームページコンテンツ取得 |
| POST | `/` | ホームページコンテンツ更新（管理者想定） |

---

## 共通

- **エラーレスポンス**: `{ "error": "メッセージ" }`、HTTP ステータス 4xx/5xx
- **認証エラー**: 401 時はクライアントでログアウト・ログイン画面へ遷移すること
