# Frontend 画面・ルート仕様

## 認証前（共通レイアウトなし）

| パス | コンポーネント | 概要 |
|------|----------------|------|
| `/login` | LoginPage | ログイン（本番では「テストユーザーでログイン」は非表示） |
| `/force-password-change` | ForcePasswordChangePage | `user.status === 'pending'` の初回ログイン時に強制表示するパスワード変更画面。変更完了まで他画面へ遷移不可 |
| `/register` | RegisterPage | 新規登録 |
| 上記以外 | Navigate to `/login` | 未認証時はログインへ |

## 認証後（Layout 内）

### ランディング

| パス | 動作 |
|------|------|
| `/` | `user.landingPage` に応じて `/home` \| `/projects`（または従来値 `gantt` の場合は `/projects?view=gantt`）\| `/companies` にリダイレクト |

### 主要画面

| パス | コンポーネント | 概要 |
|------|----------------|------|
| `/home` | HomePage | ホーム（任意コンテンツ表示） |
| `/dashboard` | DashboardPage | ダッシュボード |
| `/projects` | ProjectListPage | プロジェクト一覧。一覧内でガント等に切替可能。ランディング用にクエリ `view=gantt` でガントを初期表示（表示確定後にクエリは除去） |
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
| `/companies` | CompaniesPage | 会社一覧（API ページング・サーバー側検索。ページサイズ変更・前後ページ）。検索語・ページ・件数・法人格表示の有無は `sessionStorage` に保持し、企業詳細から一覧へ戻った際に復元する。ヘッダー（トップバー）の「企業」をクリックしたときは当該保持を削除し条件を初期化する |
| `/contacts` | ContactsPage | 連絡先一覧（全企業横断）。`GET /crm/contacts`（`companyId` なし）で取得。クライアント側検索（氏名・企業名・所属・役職・電話・メール等）。**CSV 出力**ボタンで現在の検索結果を UTF-8 BOM 付き CSV としてダウンロード。行クリックまたは企業名リンクで `/companies/:id?tab=contacts` へ遷移 |
| `/companies/:id` | CompanyDetailPage | 会社詳細。クエリ `tab` に加え、`activity=<活動ID>` で活動履歴タブ内の該当行を強調、`comment=<コメントID>` でコメントタブを開き該当コメントを強調。概要タブの基本情報では、編集の左に「統合」操作（統合先企業を選ぶモーダル → API で統合元の全関連データの企業 ID を統合先へ付け替え、統合元レコード削除）がある |
| `/associations` | AssociationsPage | 団体マスタ |
| `/legal-entity-statuses` | LegalEntityStatusesPage | 法人区分マスタ |
| `/settings` | SettingsPage | 設定（パスワード・ランディング・メニュー表示）。`user.status === 'pending'` の場合は遷移不可 |
| `/admin` | AdminPage | 管理（ユーザー・トラッカー・ステータス・優先度・グループ・ロール・会社・法人区分・団体・**メール設定**（SES / SMTP・テスト送信）・時間設定等） |

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

## 管理 > ユーザー画面のステータス運用

- ユーザー登録・編集モーダルに `status` の入力 UI は表示しない。
- ユーザー新規登録モーダルに `password` の入力 UI は表示しない（仮パスワードはサーバー側で生成）。
- ユーザー新規作成時は常に `pending`（仮）として作成する。
- 新規作成時に生成された仮パスワードは登録メールアドレスに通知する。
- 一覧のアクション表示条件:
  - 削除アイコン: `status === 'pending'` のときのみ表示
  - 無効化アイコン: `status === 'active'` のときのみ表示（確認後 `inactive` へ更新）
  - 有効化アイコン: `status === 'inactive'` のときのみ表示（確認後 `active` へ更新）
