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
| `/projects` | ProjectListPage | プロジェクト一覧。一覧／ガントチャート／カンバン／時間の4表示を切替可能。上部に統合フィルタパネル1つ（テキスト検索＋表示モードに応じた条件行：プロジェクト／チケット／ガント表示期間／時間記録）。プロジェクト条件行にはステータス（`active`＝有効・`closed`＝終了・`archived`＝アーカイブ）の複数選択フィルタがある。**時間**タブへ切替時のチケット検索初期値は担当者＝ログインユーザー・チケット期限＝当日〜当日。時間記録は記録期間＝当日〜当日・記録者＝ログインユーザー。件数サマリーと「条件をすべてクリア」で一括リセット（時間タブ中は上記時間向け初期値に戻す）。表示モード・検索条件は `sessionStorage` に保持し、詳細画面から戻った際に復元する。ヘッダー（トップバー）の「プロジェクト」をクリックしたときは当該保持を削除し条件を初期化する。ランディング用にクエリ `view=gantt` でガントを初期表示（表示確定後にクエリは除去）。**保存済み検索条件**（`projects.saved-searches` canUse）: フィルタパネルに「保存済み」ドロップダウン表示。各表示モードごとに名称付きで複数保存可能。デフォルト1件設定可（★アイコンで切替）。表示モード切替時に対応 viewMode のデフォルト検索条件を自動適用。canInput でのみ保存・更新・削除・デフォルト変更が可能 |
| `/projects/:projectId` | ProjectDetailPage | プロジェクト詳細（子ルートあり） |
| `/projects/:projectId/` (index) | ProjectOverview | 概要タブ |
| `/projects/:projectId/issues` | IssueListPage | チケット一覧。**一覧／ツリー**表示を切替可能（デフォルトはツリー。切替は `sessionStorage` に保持）。ツリー表示では親子階層でインデントし、子を持つ行は折りたたみ可能 |
| `/projects/:projectId/issues/new` | IssueFormPage | チケット新規作成。親チケット選択可（`projects.issues.fields.parent`）。子を持つ編集時はステータス・開始日・開始時刻・終了日・終了時刻は入力不可で子孫集約値を表示（ステータスは position 最小） |
| `/projects/:projectId/wiki` | WikiListPage | Wiki 一覧 |
| `/projects/:projectId/comments` | ProjectCommentsPage | プロジェクトコメント |
| `/projects/:projectId/kanban` | KanbanPage | カンバン。**子を持つチケットは非表示**（末端のみ）。親がある末端チケットはカード上に最上位親までのツリーを表示。検索条件にトラッカー・ステータス・担当者・チケット期限（期間）を指定可能 |
| `/projects/:projectId/gantt` | GanttPage | ガント（プロジェクト単位）。親チケットは子孫の期間を集約表示しバーの移動・リサイズ不可。子はインデント表示 |
| `/projects/:projectId/time-entries` | TimeEntriesPage | 工数一覧 |
| `/projects/:projectId/activities` | ProjectActivitiesPage | 活動履歴一覧（企業活動との N:N 紐づき）。表示条件: `projects.activities` canUse。既存活動の紐づけ追加・解除は `companies.activities` canInput。候補は主企業・関連企業の、当該プロジェクト未紐づけの活動。企業が未設定の場合は紐づけ不可。活動の新規作成は不可（企業詳細側で作成） |
| `/issues/:id` | IssueDetailPage | チケット詳細。親チケットへのリンクを表示。子がある場合の開始・終了・ステータスは集約値 |
| `/issues/:id/edit` | IssueFormPage | チケット編集（親チケット・開始/終了の挙動は新規作成と同様） |
| `/companies` | CompaniesPage | 会社一覧（API ページング・サーバー側検索。ページサイズ変更・前後ページ）。検索語・ページ・件数・法人格表示の有無は `sessionStorage` に保持し、企業詳細から一覧へ戻った際に復元する。ヘッダー（トップバー）の「企業」をクリックしたときは当該保持を削除し条件を初期化する |
| `/deals` | DealsPage | 商談一覧（全企業横断）。`GET /crm/deals`（`page`, `pageSize`, `q`, `status`）でサーバー側ページング・検索。ステータス絞り込みドロップダウン付き。行クリックで `/companies/:id?tab=deals` へ遷移。表示条件: `deals` canUse |
| `/contacts` | ContactsPage | 連絡先一覧（全企業横断）。`GET /crm/contacts`（`page`, `pageSize`, `q`）でサーバー側ページング・検索。ページサイズ変更・前後ページ。**CSV 出力**は一覧と同じ検索語 `q` を適用し、表示ページに関係なく一致する全件をページング取得して UTF-8 BOM 付き CSV でダウンロード（検索語なしのときは全件）。行クリックまたは企業名リンクで `/companies/:id?tab=contacts` へ遷移 |
| `/companies/:id` | CompanyDetailPage | 会社詳細。クエリ `tab` に加え、`activity=<活動ID>` で活動履歴タブ内の該当行を強調、`comment=<コメントID>` でコメントタブを開き該当コメントを強調。概要タブの基本情報では、編集の左に「統合」操作（統合先企業を選ぶモーダル → API で統合元の全関連データの企業 ID を統合先へ付け替え、統合元レコード削除）がある |
| `/associations` | AssociationsPage | 団体マスタ |
| `/legal-entity-statuses` | LegalEntityStatusesPage | 法人区分マスタ |
| `/settings` | SettingsPage | 設定（パスワード・ランディング・メニュー表示）。`user.status === 'pending'` の場合は遷移不可 |
| `/admin` | AdminPage | 管理（ユーザー・トラッカー・ステータス・優先度・グループ・**権限設定**・ロール・会社・法人区分・団体・**メール設定**（SES / SMTP・テスト送信）・時間設定等） |

### その他

| パス | 動作 |
|------|------|
| 上記にマッチしない | Navigate to `/` |

## 表示条件（メニュー・権限）

- サイドメニューは **権限設定の `canUse`** と `user.show*Menu` の両方を満たす場合に表示。
  - プロジェクト: `projects` の canUse + `showProjectsMenu`
  - 企業・連絡先・協会・法人格: 各対応コードの canUse + `showCompanyMenu`
  - 管理: `admin` の canUse + `showAdminMenu`
- ルートアクセス: 対応 feature の `canUse` が false の場合は `/` へリダイレクト。
- 新規/編集/削除ボタン: 対応 feature の `canInput` で制御。
- フォーム項目: 対応 field コードの `canInput` で disabled / 非表示。

## 管理 > 権限設定タブ

- **一覧**: 権限設定名、説明、割当グループ数、編集・削除
- **作成/編集モーダル**:
  - 基本情報（名前、説明）
  - **グループ割当**: 全グループをチェックボックスで複数選択（1 権限設定 → 複数グループ）
  - **権限マトリクス**: 権限カタログツリー + 各行「使用」「入力」チェックボックス
- **グループタブ**: グループ詳細に権限設定名を表示。編集モーダルで権限設定ドロップダウンから個別割当も可能。

## データの取得方針

- 各ページで必要な API を呼び出し（例: ProjectListPage → GET /api/projects、IssueListPage → GET /api/issues?projectId=...）。
- モーダル・タブは必要に応じて遅延取得または同一画面内でキャッシュを利用。

## 管理 > ユーザー画面のステータス運用

- 一覧上部で氏名・メール・所属グループ名による検索、およびステータス（有効・仮登録・無効）のチェックボックス絞り込みが可能。初期状態では「有効」「仮登録」にチェックが入り、「無効」はオフ（無効ユーザーのみを見る場合は「無効」をオンにする）。
- ユーザー登録・編集モーダルに `status` の入力 UI は表示しない。
- ユーザー新規登録モーダルに `password` の入力 UI は表示しない（仮パスワードはサーバー側で生成）。
- ユーザー新規作成時は常に `pending`（仮）として作成する。
- 新規作成時に生成された仮パスワードは登録メールアドレスに通知する。
- 一覧のアクション表示条件:
  - 削除アイコン: `status === 'pending'` のときのみ表示
  - 無効化アイコン: `status === 'active'` のときのみ表示（確認後 `inactive` へ更新）
  - 有効化アイコン: `status === 'inactive'` のときのみ表示（確認後 `active` へ更新）
