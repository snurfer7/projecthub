# Frontend 画面・ルート仕様

## 認証前（共通レイアウトなし）

| パス | コンポーネント | 概要 |
|------|----------------|------|
| `/login` | LoginPage | ログイン（本番では「テストユーザーでログイン」は非表示） |
| `/register` | RegisterPage | 新規登録 |
| 上記以外 | Navigate to `/login` | 未認証時はログインへ |

## 認証後（Layout 内）

### ランディング

| パス | 動作 |
|------|------|
| `/` | `user.landingPage` に応じて `/home` \| `/projects` \| `/gantt` \| `/companies` にリダイレクト |

### 主要画面

| パス | コンポーネント | 概要 |
|------|----------------|------|
| `/home` | HomePage | ホーム（任意コンテンツ表示） |
| `/dashboard` | DashboardPage | ダッシュボード |
| `/projects` | ProjectListPage | プロジェクト一覧 |
| `/projects/:projectId` | ProjectDetailPage | プロジェクト詳細（子ルートあり） |
| `/projects/:projectId/` (index) | ProjectOverview | 概要タブ |
| `/projects/:projectId/issues` | IssueListPage | チケット一覧 |
| `/projects/:projectId/issues/new` | IssueFormPage | チケット新規作成 |
| `/projects/:projectId/wiki` | WikiListPage | Wiki 一覧 |
| `/projects/:projectId/comments` | ProjectCommentsPage | プロジェクトコメント |
| `/projects/:projectId/kanban` | KanbanPage | カンバン |
| `/projects/:projectId/gantt` | GanttPage | ガント（プロジェクト単位） |
| `/projects/:projectId/time-entries` | TimeEntriesPage | 工数一覧 |
| `/issues/:id` | IssueDetailPage | チケット詳細 |
| `/issues/:id/edit` | IssueFormPage | チケット編集 |
| `/gantt` | GanttAllPage | ガント（全体） |
| `/companies` | CompaniesPage | 会社一覧 |
| `/companies/:id` | CompanyDetailPage | 会社詳細 |
| `/associations` | AssociationsPage | 団体マスタ |
| `/legal-entity-statuses` | LegalEntityStatusesPage | 法人区分マスタ |
| `/settings` | SettingsPage | 設定（パスワード・ランディング・メニュー表示） |
| `/admin` | AdminPage | 管理（ユーザー・トラッカー・ステータス・優先度・グループ・ロール・会社・法人区分・団体・時間設定等） |

### その他

| パス | 動作 |
|------|------|
| 上記にマッチしない | Navigate to `/` |

## 表示条件（メニュー）

- サイドメニューは `user.show*Menu` に従い、プロジェクト・ガント・会社・管理 の各項目を出し分け。
- **管理機能**（`/admin` および管理メニュー項目）は、次のいずれかを満たすユーザーに表示・アクセス可能とする。
  - `user.role === 'admin'`（管理者ロール）
  - `user.isAdmin === true`（システム管理者にチェックが入っているユーザー）
- 上記のうち、`showAdminMenu` が false の場合は管理メニュー項目を非表示にする（アクセス権限は上記のまま）。

## データの取得方針

- 各ページで必要な API を呼び出し（例: ProjectListPage → GET /api/projects、IssueListPage → GET /api/issues?projectId=...）。
- モーダル・タブは必要に応じて遅延取得または同一画面内でキャッシュを利用。
