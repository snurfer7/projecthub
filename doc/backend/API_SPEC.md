# Backend API 仕様

Base URL: `/api`（認証が必要なエンドポイントは `Authorization: Bearer <token>` を付与）

---

## Auth — `/api/auth`

| メソッド | パス | 認証 | 概要 |
|----------|------|------|------|
| POST | `/login` | 不要 | ログイン。Body: `email`, `password` → `token`, `user` |
| POST | `/register` | 不要 | 登録。Body: `email`, `password`, `firstName`, `lastName` → `token`, `user` |
| GET | `/me` | 必要 | 現在ユーザー情報 |
| PUT | `/password` | 必要 | パスワード変更。Body: `currentPassword`, `newPassword` |
| PUT | `/landing-page` | 必要 | ランディング設定。Body: `landingPage` (`home` \| `projects` \| `gantt` \| `companies`) |
| PUT | `/menu-settings` | 必要 | メニュー表示。Body: `showProjectsMenu`, `showGanttMenu`, `showCompanyMenu`, `showAdminMenu` |

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

---

## Issues — `/api/issues`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | チケット一覧。Query: `projectId`, `statusId`, `trackerId`, `priorityId`, `assignedToId`, `assignedToGroupId` |
| GET | `/meta/options` | メタ（trackers, statuses, priorities, users, groups）。Query: `projectId`（任意） |
| GET | `/:id` | チケット詳細 |
| POST | `/` | チケット作成 |
| PUT | `/:id` | チケット更新 |
| DELETE | `/:id` | チケット削除 |
| PUT | `/reorder` | 順序更新。Body: `issues: [{ id, position }]` |
| POST | `/:id/relations` | 関連追加 |
| DELETE | `/relations/:relationId` | 関連削除 |
| POST | `/:id/comments` | コメント追加 |
| PUT | `/:id/comments/:commentId` | コメント更新 |
| DELETE | `/:id/comments/:commentId` | コメント削除 |

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
| DELETE | `/:id` | 削除 |

---

## Time Entries — `/api/time-entries`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | 一覧。Query: `projectId`, `userId`（任意） |
| POST | `/` | 作成。Body: `projectId`, `issueId`（任意）, `hours`, `activity`, `spentOn`, `comments`（任意） |
| PUT | `/:id` | 更新 |
| DELETE | `/:id` | 削除 |

---

## Admin — `/api/admin`

管理者向け。ユーザー・マスタ・会社・団体・法人区分・設定の CRUD および並び替え。

| メソッド | パス | 概要 |
|----------|------|------|
| GET/POST/PUT/DELETE | `/users` | ユーザー |
| GET/POST/PUT/DELETE, POST reorder | `/trackers` | トラッカー |
| GET/POST/PUT/DELETE, POST reorder | `/statuses` | チケットステータス |
| GET/POST/PUT/DELETE, POST reorder | `/priorities` | 優先度 |
| GET/GET:id/POST/PUT/DELETE | `/groups` | グループ |
| GET/POST/PUT/DELETE, POST reorder, GET/PUT transitions | `/roles` | ロール・ワークフロー遷移 |
| GET/GET:id/POST/PUT/DELETE | `/companies` | 会社（管理者用一覧） |
| GET/POST/PUT/DELETE, POST reorder | `/legal-entity-statuses` | 法人区分 |
| GET/POST/PUT/DELETE | `/associations` | 団体 |
| POST/DELETE | `/companies/:id/associations/:associationId` | 会社-団体紐付け |
| GET/PUT | `/settings/time` | 時間設定（管理時間・換算時間） |

---

## Gantt — `/api/gantt`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/project/:projectId` | 指定プロジェクトのガント用データ |
| GET | `/all` | 全プロジェクトのガント用データ |

---

## Companies — `/api/companies`

| メソッド | パス | 概要 |
|----------|------|------|
| GET | `/` | 会社一覧 |
| GET | `/:id` | 会社詳細 |
| POST | `/:companyId/associations/:associationId` | 団体紐付け |
| DELETE | `/:companyId/associations/:associationId` | 団体紐付け解除 |
| GET/POST/PUT | `/:companyId/comments`, `/:companyId/comments/:commentId` | コメント |
| GET | `/:companyId/wiki` | 会社 Wiki 一覧 |
| GET/PUT/DELETE | `/:companyId/wiki/:title` | 会社 Wiki ページ（title 指定） |
| PATCH | `/:companyId/wiki/:title/move` | 会社 Wiki 移動 |
| GET/POST/PUT/DELETE | `/:companyId/locations`, `/:companyId/locations/:locationId` | 拠点 |

---

## CRM — `/api/crm`

| メソッド | パス | 概要 |
|----------|------|------|
| GET/POST/PUT/DELETE | `/contacts`, `/contacts/:id` | コンタクト |
| GET/POST/PUT/DELETE | `/contacts/:id/comments`, `/:commentId` | コンタクトコメント |
| GET/POST/PUT/DELETE | `/deals`, `/deals/:id` | 商談 |
| GET/POST/PUT/DELETE | `/activities`, `/activities/:id` | アクティビティ |

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
