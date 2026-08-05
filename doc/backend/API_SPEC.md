# Backend API 仕様

Base URL: `/api`（認証が必要なエンドポイントは `Authorization: Bearer <token>` を付与）

---

## Auth — `/api/auth`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| POST | `/login` | 不要 | パスワードログイン。Body: `email`, `password` → `token`, `user`（`status`, `authMethod`, `microsoftLinked` を含む）。`status === 'inactive'` は 401。`authMethod === 'sso'` のユーザーは 401（Microsoft ログインを案内） |
| POST | `/register` | 不要 | 登録。Body: `email`, `password`, `firstName`, `lastName` → `token`, `user` |
| GET | `/me` | 必要 | 現在ユーザー情報（`status`, `authMethod`, `microsoftLinked`, `permissions`, **`uiPreferences`** を含む）。`permissions` は `Record<string, { canUse: boolean, canInput: boolean }>`。`uiPreferences` は個人 UI 設定 JSON（ガント左ペイン列など） |
| PUT | `/password` | 必要 | パスワード変更。Body: `currentPassword`, `newPassword`。`authMethod === 'sso'` のときは 400。`pending` の場合は更新完了時に `active` へ |
| PUT | `/landing-page` | 必要 | ランディング設定。Body: `landingPage` (`home` \| `projects` \| `companies`) |
| PUT | `/menu-settings` | 必要 | メニュー表示。Body: `showProjectsMenu`, `showGanttMenu`, `showCompanyMenu`, `showAdminMenu` |
| PUT | `/ui-preferences` | 必要 | 個人 UI 設定の部分更新。Body: `{ uiPreferences: { gantt?: { columns?: { key, visible, width }[] } } }`。既存 JSON とマージし、`gantt.columns` 指定時は正規化して置換。列 key は `ticket` \| `priority` \| `assignee` \| `status` \| `schedule` \| `estimated` \| `actual`。`ticket` は常に visible。応答: `{ message, uiPreferences }` |
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

**メンバー可視性**: `POST /`（作成）と `GET /roles/available` を除き、操作対象プロジェクトに `ProjectMember` として登録されているユーザーのみアクセス可。一覧は所属プロジェクトのみ返す。非メンバーは **403**（`このプロジェクトを参照する権限がありません`）。**例外**: `isAdmin` のユーザーは全プロジェクトを参照・操作可能。作成者は作成時に自動でメンバーとなり、**全ロール**を付与される。

**二層権限**: グループ PermissionSet の `projects`（use/input）でアプリ機能のゲート。プロジェクト詳細（プロジェクト情報更新・メンバー・チケット・Wiki 等および項目権限）は **RolePermission**（プロジェクト内ロール）で制御。`GET /:id` 応答に `myPermissions`（当該ユーザーのロール権限マップ）を含む。不足時は **403**（`このプロジェクトでの操作権限がありません`）。`User.isAdmin` ではロール権限をバイパスしない。

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | プロジェクト一覧（所属メンバーのプロジェクトのみ）。権限: `projects` use |
| GET | `/:id` | プロジェクト詳細（メンバー必須）。応答に `myPermissions` |
| POST | `/` | プロジェクト作成。権限: `projects` input |
| PUT | `/:id` | プロジェクト情報の更新。権限: `projects` use + ロール `projects.overview` input |
| DELETE | `/:id` | プロジェクト削除。権限: `projects` use + ロール `projects.overview` input |
| POST | `/:id/members` | メンバー追加。ロール `projects.members` input |
| PUT | `/:id/members/:memberId` | メンバー・ロール更新。ロール `projects.members` input。更新の結果メンバーが 0 件になる場合は、操作ユーザーを全ロール付きで自動追加 |
| DELETE | `/:id/members/:memberId` | メンバー削除。ロール `projects.members` input。削除の結果メンバーが 0 件になる場合は、操作ユーザーを全ロール付きで自動追加 |
| GET | `/roles/available` | 利用可能ロール一覧。権限: `projects` use |
| GET | `/:id/groups` | プロジェクト紐付けグループ一覧。ロール `projects.members` use |
| POST | `/:id/groups` | グループ紐付け。ロール `projects.members` input |
| PUT | `/:id/groups/:groupId/role` | グループのロール設定更新。ロール `projects.members` input |
| DELETE | `/:id/groups/:groupId` | グループ紐付け解除。ロール `projects.members` input。解除の結果メンバーが 0 件になる場合は、操作ユーザーを全ロール付きで自動追加 |
| GET | `/:id/comments` | コメント一覧（メンバー必須） |
| POST | `/:id/comments` | コメント追加（メンバー必須） |
| PUT | `/:id/comments/:commentId` | コメント更新（メンバー必須） |
| GET | `/:id/activities` | プロジェクトに紐づく活動履歴一覧（N:N）。権限: `projects.activities` use。メンバー必須 |
| POST | `/:id/activities` | 既存活動をプロジェクトへ紐づけ。Body: `{ activityId }`。権限: `companies.activities` input。活動の企業が当該プロジェクトの主企業または関連企業であること。メンバー必須 |
| DELETE | `/:id/activities/:activityId` | プロジェクトと活動の紐づけ解除。権限: `companies.activities` input。メンバー必須 |

---

## Issues — `/api/issues`

**メンバー可視性**: 所属プロジェクトのチケットのみ参照・操作可。一覧は所属プロジェクトに絞り込む。`projectId` 指定時やチケット ID 指定時に非メンバーなら **403**。**例外**: `isAdmin` は全プロジェクト可。

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | チケット一覧（所属プロジェクトのみ）。Query: `projectId`, `statusId` / `statusIds`（複数）, `trackerId` / `trackerIds`（複数）, `priorityId`, `assignedToId` / `assignedToIds`（担当ユーザーのいずれかが一致）, `assignedToGroupId`。複数 ID はカンマ区切りまたは配列。応答に **`assignees`**（`{ id, firstName, lastName }[]`）, `assignedToGroup`, `parentId` / `parent` / `_count.children` を含み、子を持つチケットの `startDate` / `endDate` / `statusId`（`status`）は子孫から集約した値（ステータスは position 最小）。`project` は `{ id, name, company: { id, name } \| null }` を含む（カンバン等クロスプロジェクト表示での企業名表示用）。後方互換で `assignedTo` / `assignedToId` は `assignees` の先頭（無ければ null） |
| GET | `/meta/options` | メタ（trackers, statuses, priorities, users, groups）。Query: `projectId`（任意）。`projectId` 指定時はメンバー必須で、プロジェクトメンバー・紐付きグループのみ返し、応答に **`workflow`**（当該ユーザーのロールに基づく利用可能ステータス・遷移）を含む。未指定時は全ユーザー・全グループを返し `workflow` は含めない。`statuses` は常に全マスタ（カンバン列・フィルタ用） |
| GET | `/:id` | チケット詳細（所属プロジェクトのみ）。`assignees` / `assignedToGroup` / `parent` / `children`（id, subject, startDate, endDate）を含む。子がある場合 `startDate` / `endDate` / `status` は集約値 |
| POST | `/` | チケット作成（対象プロジェクトのメンバー必須）。Body: **`assignedToIds`**（任意・`number[]`。空配列で担当ユーザーなし。旧 `assignedToId` 単数も受理し 1 件配列相当）, `assignedToGroupId`（任意）, `parentId`（任意・同一プロジェクト・循環不可）, **`estimatedHours`**（任意・0 以上・**0.5 刻み**の数値。空／null で未設定）等。仮登録・無効ユーザーは 400。`statusId` はロールの利用可能ステータスに含まれること（否則 400）。権限: `projects.issues.fields.assignee`（`assignedToIds` / `assignedToGroupId` / 旧 `assignedToId` 指定時）, `projects.issues.fields.parent`（`parentId` 指定時）, `projects.issues.fields.estimatedHours`（`estimatedHours` 指定時） |
| PUT | `/:id` | チケット更新（所属プロジェクトのみ）。Body: **`assignedToIds`**（指定時は中間テーブルをその集合に同期。空配列で全解除。未指定時は変更しない。旧 `assignedToId` も受理）, `assignedToGroupId`, `parentId`（任意・null で解除）, **`estimatedHours`**（任意・0 以上・**0.5 刻み**。空／null で未設定）等。子チケットがある場合 `startDate` / `endDate` / `statusId` の更新は 400。`statusId` 変更時はロールの利用可能ステータス＋ステータス遷移を検証（否則 400）。権限: `projects.issues.fields.assignee` / `projects.issues.fields.parent` / `projects.issues.fields.estimatedHours` 等 |
| DELETE | `/:id` | チケット削除（所属プロジェクトのみ） |
| PUT | `/reorder` | 順序更新。Body: `issues: [{ id, position }]`（対象チケットのプロジェクトへの所属必須） |
| POST | `/:id/relations` | 関連追加（所属プロジェクトのみ） |
| DELETE | `/relations/:relationId` | 関連削除（関連元チケットのプロジェクトへの所属必須） |
| POST | `/:id/comments` | コメント追加（所属プロジェクトのみ） |
| PUT | `/:id/comments/:commentId` | コメント更新（所属プロジェクトのみ） |
| DELETE | `/:id/comments/:commentId` | コメント削除（所属プロジェクトのみ） |

親チケットの開始・終了日時およびステータスは子から導出するため、子があるチケットへの `startDate` / `endDate` / `statusId` 書き込みは拒否する。

### `workflow`（`GET /meta/options?projectId=`）

```json
{
  "assignableStatusIds": [1, 2, 3],
  "allowedTransitions": [{ "oldStatusId": 1, "newStatusId": 2 }]
}
```

- `assignableStatusIds` — 作成時に選べるステータス、および遷移先として許可されるステータス（ロール RoleStatus の OR。未設定ロールは全ステータス寄与）
- `allowedTransitions` — 許可される旧→新の組（ロール WorkflowTransition の OR）。`null` のときは遷移制限なし（いずれかのロールが遷移未設定）。空配列は遷移不可

解決ルールの詳細は [DATA_MODEL.md](DATA_MODEL.md)「チケットステータス・ワークフローの解決」を参照。

---

## Wiki（プロジェクト） — `/api/wiki`

**メンバー可視性**: 対象プロジェクトのメンバーのみ。非メンバーは **403**。**例外**: `isAdmin` は全プロジェクト可。

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/project/:projectId` | プロジェクトの Wiki 一覧（メンバー必須） |
| GET | `/:id` | Wiki ページ詳細（id はページ ID。所属プロジェクトのみ） |
| POST | `/` | ページ作成。Body: `projectId`, `title`, `content`, `parentId`（任意）。メンバー必須 |
| PUT | `/:id` | ページ更新。Body: `title`, `content`, `parentId`（所属プロジェクトのみ） |
| DELETE | `/:id` | ページ削除（所属プロジェクトのみ） |
| PATCH | `/:id/move` | 移動。Body: `parentId`, `position`（所属プロジェクトのみ） |

---

## Attachments — `/api/attachments`

**メンバー可視性**: プロジェクト／チケット／プロジェクトコメント由来の添付は、当該プロジェクトのメンバーのみ操作可。企業コメント等の企業側添付は従来どおり（メンバー制約なし）。**例外**: `isAdmin` はプロジェクト系も全件可。

| メソッド | パス | 概要 |
|----------|------|------|
| POST | `/upload` | ファイルアップロード（multipart, `file`）。プロジェクト系はメンバー必須 |
| POST | `/token/:id` | トークン発行（ダウンロード用）。プロジェクト系はメンバー必須 |
| GET | `/download/:id` | ダウンロード（認証 or トークン）。認証時のプロジェクト系はメンバー必須 |
| GET | `/file/:id` | ファイル取得 |
| DELETE | `/:id` | 削除（認証済み）。会社コメント経由の添付も同一 API で削除し、コメント側の一覧からも消える。プロジェクト系はメンバー必須 |

---

## Time Entries — `/api/time-entries`

**メンバー可視性**: 所属プロジェクトの工数のみ参照・操作可。一覧は所属プロジェクトに絞り込む。非メンバーの `projectId` 指定や既存エントリ操作は **403**。**例外**: `isAdmin` は全プロジェクト可。

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | 一覧（所属プロジェクトのみ）。Query: `projectId`, `issueId`, `startDate`, `endDate`, `userId`（単一・後方互換）, `userIds`（カンマ区切りまたは配列で複数担当者） |
| POST | `/` | 作成。Body: `projectId`, `issueId`（任意）, `hours`, `activity`, `spentOn`, `comments`（任意）。メンバー必須 |
| PUT | `/:id` | 更新（所属プロジェクトのみ） |
| DELETE | `/:id` | 削除（所属プロジェクトのみ） |

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
| GET/POST/PUT/DELETE, POST reorder | `/statuses` | チケットステータス。Body: `name`, **`isClosed`**（終了フラグ・boolean）, `position`。`isClosed` の指定・変更は `admin.statuses.fields.isClosed` input | `admin.statuses` use / input |
| GET/POST/PUT/DELETE, POST reorder | `/priorities` | 優先度 | 管理者 |
| GET/GET:id/POST/PUT/DELETE | `/groups` | グループ（`permissionSetId` 割当可） | `admin.groups` |
| GET/POST/PUT/DELETE, POST reorder, GET/PUT transitions | `/roles` | ロール・ワークフロー遷移 | 管理者 |
| GET/GET:id/POST/PUT/DELETE | `/companies` | 会社（一覧・詳細・作成・更新・削除） | 認証 |
| GET/POST/PUT/DELETE, POST reorder | `/legal-entity-statuses` | 法人区分 | 認証 |
| GET/POST/PUT/DELETE | `/associations` | 団体 | 認証 |
| POST/DELETE | `/companies/:id/associations/:associationId` | 会社-団体紐付け | 認証 |
| GET/PUT | `/settings/time` | 時間設定（管理時間・換算時間） | `admin.time-settings` use / input |
| GET/PUT | `/settings/email` | メール送信設定（SES API / SMTP の切替、送信元、SMTP 接続情報）。SMTP パスワードは保存時にサーバー側で暗号化され、GET では `smtpPasswordSet` のみ返す | `admin.email-settings` use / input |
| POST | `/settings/email/test` | テストメール送信。Body: `toEmail`（保存済み設定で 1 通送信） | `admin.email-settings` input |
| GET/PUT | `/settings/holidays` | 休日設定（曜日休日・個別休日・個別出勤） | `admin.holiday-settings` use / input |

**メール設定（`/settings/email`）**

- **`emailTransport`**: `ses`（従来どおり AWS SDK の SES `SendEmail`）または `smtp`（SMTP 経由。Amazon SES の SMTP エンドポイント等）。
- **`emailFromOverride`**: 空でない場合、環境変数 `EMAIL_FROM` より優先して送信元に使う。空文字でクリア。
- **SMTP 時の必須**: `smtpHost`, `smtpUser`。初回またはパスワード未保存時は `smtpPassword` が必須。以降の更新でパスワードを変えない場合は `smtpPassword` を送らない（または空）。
- **暗号化キー**: SMTP パスワードは `EMAIL_ENCRYPTION_KEY`（64 文字 hex 推奨）または未設定時は `JWT_SECRET` から導出したキーで AES-256-GCM 暗号化して DB に保存する。

**休日設定（`/settings/holidays`）**

- **GET 応答 / PUT Body**: `{ holidayWeekdays: number[], holidays: { date: string, name: string }[], workdays: { date: string, name: string }[] }`
- **`holidayWeekdays`**: 0=日曜〜6=土曜。重複除去・範囲外は 400。未作成時のデフォルトは `[0, 6]`（土日）。
- **`holidays` / `workdays`**: `date` は `YYYY-MM-DD`。同一配列内で日付重複は後勝ち（または 400）。名称は必須（空文字不可）。日付昇順で返す。
- **判定優先度（利用側）**: 個別出勤日 ⊂ 個別休日 ⊂ 曜日休日（出勤日があれば出勤、なければ個別休日、なければ曜日）。
- 国民の祝日 JSON（`https://holidays-jp.github.io/api/v1/date.json`）の取得・プレビューはフロントで行い、ユーザーが選択した年のみを既存 `holidays` にマージして PUT する。

---

## Saved Searches — `/api/saved-searches`

認証必須。操作は常にログイン中ユーザーのデータのみ対象。

| メソッド | パス | 概要 | 権限 |
|----------|------|------|------|
| GET | `/` | 一覧。Query: `viewMode`（必須: `list` \| `gantt` \| `kanban` \| `time`）| `projects.saved-searches` use（グループ権限） |
| POST | `/` | 作成。Body: `{ viewMode, name, filter, isDefault? }` | `projects.saved-searches` input |
| PUT | `/:id` | 更新。Body: `{ name?, filter?, isDefault? }` | `projects.saved-searches` input（他ユーザーのデータは 404） |
| DELETE | `/:id` | 削除 | `projects.saved-searches` input（他ユーザーのデータは 404） |

**isDefault の挙動**: `isDefault: true` で作成・更新した場合、同一ユーザー × 同一 viewMode の他の保存済み検索条件の `isDefault` を自動的に `false` に更新する。

**レスポンス形状**（SavedSearch オブジェクト）:
```json
{
  "id": 1,
  "userId": 2,
  "viewMode": "list",
  "name": "有効プロジェクトのみ",
  "isDefault": true,
  "filter": { "projectFilter": { ... }, "issueFilter": { ... }, "listSort": [{ "key": "name", "direction": "asc" }], "issueSort": [{ "key": "id", "direction": "asc" }] },
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## Gantt — `/api/gantt`

**メンバー可視性**: 所属プロジェクトのみ。`/project/:projectId` で非メンバーは **403**。`/all` は所属かつ `active` のプロジェクトのみ。**例外**: `isAdmin` は全プロジェクト可。

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/project/:projectId` | 指定プロジェクトのガント用データ（メンバー必須）。チケットに `parentId` を含み、親の開始・終了・ステータスは子孫から集約。`startDate` / `endDate` / `dueDate` がすべて未設定のチケットも含む。各チケットに `actualHours`（当該チケットの `TimeEntry.hours` 合計。記録なしは `0`）を付与 |
| GET | `/all` | 所属かつ有効（`active`）プロジェクトのガント用データ（同上。日付未設定チケットも含む）。`projects` は `company: { id, name }` を含む（ガントのプロジェクト行で企業名を表示するため） |

権限: `/project/:projectId` は `projects` use ＋ 当該プロジェクトの `projects.gantt` use。`/all` は `projects` use（返却プロジェクトは `projects.gantt` use のあるものに限定）。

ガントの曜日・個別休日の表示および予定工数からの終了日算出は、下記 **Settings（カレンダー）** の休日設定を参照する（営業日のみ進める。判定優先度は `/admin/settings/holidays` と同じ）。

---

## Settings — `/api/settings`

認証必須（PermissionSet の feature 権限は不要。組織共通の参照専用）。

| メソッド | パス | 概要 | 権限 |
|----------|------|------|------|
| GET | `/calendar` | 営業時間・換算時間・休日設定の参照。応答: `startTime`, `endTime`, `managementTimes`, `conversionTimes`, `holidayWeekdays`, `holidays`, `workdays` | 認証のみ |

書き込みは従来どおり `/api/admin/settings/time`・`/api/admin/settings/holidays`。

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
| GET/POST/PUT/DELETE | `/contacts`, `/contacts/:id` | コンタクト。**GET `/contacts`**: Query `companyId`（任意）— 企業別絞り込み。Query `page` あり — ページング応答 `{ items, total, page, pageSize, totalPages }`。Query `q`（任意）— 氏名・企業名・備考・連絡先詳細（所属・役職・電話・メール・拠点名）の部分一致（大文字小文字無視）。`page` なし — 配列（ドロップダウン・企業詳細タブ用）。一覧の各 `details[].location` は `id`, `name`, `postalCode`, `prefecture`, `city`, `street`, `building` を含む |
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
