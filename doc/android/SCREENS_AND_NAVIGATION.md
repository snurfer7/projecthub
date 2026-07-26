# Android 画面・ナビゲーション仕様

## ルート定義（Screen sealed class）

- **認証**: `Login` (`login`), `Register` (`register`)
- **メイン（BottomNav）**: `Home` (`home`), `Projects` (`projects`), `Issues` (`issues`), `Time` (`time`), `Companies` (`companies`)
- **設定**: `Settings` (`settings`), `ApiSettings` (`api_settings`)
- **詳細・子画面**:
  - `ProjectDetail` — `project/{projectId}`
  - `ProjectIssues` — `project/{projectId}/issues`
  - `IssueDetail` — `issue/{issueId}`
  - `IssueCreate` — `issue/create?projectId={projectId}`（projectId は任意）
  - `IssueEdit` — `issue/{issueId}/edit`
  - `Kanban` — `project/{projectId}/kanban`
  - `WikiList` — `project/{projectId}/wiki`
  - `WikiDetail` — `project/{projectId}/wiki/{pageId}`
  - `CompanyDetail` — `company/{companyId}?tab={tab}`（`tab` は任意: `home`|`contacts`|`deals`|`activities`|`wiki`|`comments`|`locations`。指定時はその タブを初期選択）
  - `Contacts` — `contacts`（連絡先一覧・全社横断）
  - `Deals` — `deals`（商談一覧・全社横断）
  - `TimeCreate` — `time/create?projectId={projectId}`（projectId は任意）
  - `BusinessCardScan` — `company/business_card_scan`（名刺スキャン画面）
  - `Gantt` — `project/{projectId}/gantt`（ガントチャート）

## 新規作成ダイアログ（FAB）

以下の画面では Scaffold に FloatingActionButton（＋）を配置し、タップでダイアログを表示する。

| 画面 | ダイアログ | フィールド |
|------|-----------|-----------|
| ProjectListScreen | プロジェクト登録 | 名前*, 識別子*, 企業, 親プロジェクト, 期限日, 説明 |
| CompanyListScreen | 会社登録（右下 FAB: Add） | 会社名*, 法人格, 法人格前後（前/後）, 郵便番号, 電話番号, 都道府県, 市区町村, 町域・番地, 建物名, Webサイト, 備考 |
| CompanyListScreen | 名刺スキャン（左下 FAB: DocumentScanner） | ML Kit Document Scanner を起動（マルチページ）→ BusinessCardScanScreen へ遷移 |
| CompanyDetailScreen（連絡先タブ） | 連絡先登録 | 姓*, 名*, 部署, 役職, 電話, メール, メモ |
| CompanyDetailScreen（商談タブ） | 商談登録 | 商談名*, ステータス, 金額, 確度, 見込み日, メモ |
| CompanyDetailScreen（活動履歴タブ） | 活動登録 | 種別*（電話/メール/訪問/会議/メモ）, 件名*, 内容, 関連連絡先, 期日 |
| CompanyDetailScreen（拠点タブ） | 拠点登録 | 拠点名*, 郵便番号, 電話番号, 都道府県, 市区町村, 町域・番地, 建物名, 備考 |

## チケットの親子階層

- `IssueListScreen` は `ProjectListScreen` と同じアルゴリズム（`ui/utils/IssueTreeUtils.kt` の `buildIssueTreeDisplayRows`）で `parentId` によるツリー表示・折りたたみを行う。子を持つチケット行は開始日・終了日を「集計」として表示する。
- `IssueDetailScreen`: `issue.parent` があれば見出し直下に親チケットへの1段パンくずを表示し、タップで親チケットの `IssueDetail` へ自己遷移する。`issue.children` があれば「子チケット」セクションを表示し、タップでその子チケットの `IssueDetail` へ遷移する。終了日 (`endDate`) を詳細情報に表示する。
- `IssueFormScreen`:
  - 親チケット選択ドロップダウンを追加（`projectId` が確定している場合のみ表示）。候補は同一プロジェクトのチケットから自分自身と自分の子孫（`collectDescendantIds`）を除外したもの。
  - 終了日 (`endDate`) の入力欄を開始日・期限日と並べて追加。
  - **子チケットを持つチケット**（`issue._count.children > 0`）は、開始日・終了日・ステータスの入力を非活性にし「子チケットから自動集計されます」と表示する。保存時もこれらのキーは送らない（サーバ集約値のため直接更新すると 400 になる）。
  - 親チケットの解除（「なし」を選択）は、`UpdateIssueRequest.parentId` に明示的な JSON null を送る（`parentIdBody(null)`）。

## 保存済み検索（モバイル縮小版）

- チケット一覧・カンバンのフィルタシート（`IssueFilterBottomSheet`）上部に「保存済み条件」チップ行を表示する。チップタップで適用、長押しで「既定にする」「削除」、右端の「現在の条件を保存」から名前を付けて保存できる（保存・更新・削除は `IssueFilterBottomSheet` 内で完結）。
- 画面初回表示時、既定（`isDefault=true`）の保存済み検索があれば自動適用する。
- **web との相互運用はしない**（`viewMode` の使い方・`filter` の形状が異なるため）。保存時に `filter.client="android"` を付与し、一覧取得時はこのマーカーを持つものだけを表示する。

## プロジェクトの関連活動（N:N）

- `ProjectDetailScreen` に「関連活動」セクションを追加。`GET api/projects/{id}/activities` で一覧表示（403 時はセクション自体を非表示にする）。
- 右上「追加」→ ボトムシートで、プロジェクトの主企業・関連企業に属する活動のうち未紐づけのものを一覧表示し、タップで即 `POST api/projects/{id}/activities`（Body `{activityId}`）により紐づけ。
- 各行の解除アイコンから確認ダイアログ→ `DELETE api/projects/{id}/activities/{activityId}` で解除。
- 主企業・関連企業のいずれもないプロジェクトでは「追加」を非活性にし「関連付け可能な企業がありません」を表示する。

## 企業統合

- `CompanyDetailScreen` の概要タブに「統合」ボタンがある。タップで統合先企業を検索・選択するダイアログ → 確認ダイアログ（不可逆であることを明示）→ `POST api/companies/{id}/merge` を実行。成功時は統合先の `CompanyDetail` へ遷移し、統合元（削除済み）へは戻れないよう `popUpTo(Companies)` でバックスタックを整理する。
- 統合先の候補は企業一覧の取得済みデータ（`CompanyViewModel.listUiState.companies`）から自分自身を除いたものを名前で絞り込んで表示する。
- 権限 `companies.merge` の input がない場合は 403 エラーを表示する。

## 連絡先一覧・商談一覧（全社横断）

- **配置**: BottomNav は4タブ（ホーム/プロジェクト/企業/設定）のまま据え置き、`CompanyListScreen` の TopAppBar ⋮メニューから「連絡先一覧」「商談一覧」へ遷移する（web の情報設計＝サイドメニュー「企業」配下に `/contacts`・`/deals` がある構成に合わせる。BottomNav 5項目化と企業詳細タブとの導線重複を避けるため）。
- `ContactsListScreen`/`DealsListScreen`: サーバ側ページング・検索（`GET api/crm/contacts|deals` の `page`/`pageSize`/`q`）。検索は300msデバウンス、スクロール末尾到達で次ページを自動読込。行タップで `CompanyDetail(companyId, tab)` へ遷移し該当タブを初期選択する。
- 企業一覧⋮メニュー選択中も BottomNav の「企業」タブはハイライトされ続ける。
- 商談一覧は権限 `deals` の use が必要（403 時はエラー画面）。

## ガントチャート

- `GanttScreen`（`GET api/gantt/project/{projectId}`）はプロジェクト単位で読み取り専用のガントを表示する。行順はチケット一覧と同じツリー構築（`buildIssueTreeDisplayRows`）。親の開始・終了はサーバ側で子孫から集約済みのためクライアントでの再計算はしない。開始日・終了日・期日がすべて未設定のチケットも「日付未設定」として行に表示する（バーなし）。バーまたは行タップで `IssueDetail` へ遷移する。
- **モバイル版はドラッグによる日程変更・バー端リサイズ・ズーム（日/週/月切替）・プロジェクト横断表示（`/api/gantt/all`）を意図的に実装しない**（タッチ操作での日単位精度の操作は誤操作が多く小画面での価値が低いため。日程変更は `IssueFormScreen` で行う）。
- `ProjectDetailScreen` のクイックアクションから遷移する（チケット／カンバン／ガント／Wiki の2行×2ボタン配置）。
- 権限 `projects.gantt` の use がない場合は「ガントの閲覧権限がありません」を表示する。

## カンバンの末端チケット表示・フィルタ

- `KanbanScreen` は子チケットを持つチケット（親）を表示せず、**末端チケットのみ**をカードとして表示する（`ui/utils/IssueTreeUtils.kt` の `isLeafIssue`）。カード上部に祖先チェーン（`getAncestorChain`、例: 「親 / 祖父」）をパンくずとして表示する。
- チケット一覧・カンバンとも、TopAppBar のフィルターアイコンから共通のフィルタシート（`ui/issues/IssueFilterBottomSheet.kt`）を開く。トラッカー・ステータス・優先度・担当者・担当グループは複数選択、期日は期間（開始〜終了）で絞り込み可能。担当グループを選択した場合、そのグループのメンバーが担当するチケットも一致対象に含む。
- フィルタはシート内で編集し「適用」を押すまで確定しない。アクティブなフィルタはチップ表示され、チップの✕で個別解除できる。

## プロジェクト一覧のツリー表示

- `ProjectListScreen` は `parentId` で親子階層を構築し、深さ優先（pre-order）でツリー表示する（`ui/utils/ProjectTreeUtils.kt` の `buildProjectTreeDisplayRows`）。
- 子を持つ行には展開／折りたたみアイコンを表示し、折りたたみ時は子孫行を非表示にする（画面ローカルな状態で、永続化しない）。
- 検索フィルタ後の一覧に親が含まれず子だけが残った場合、その子はルート（depth 0）として表示する。
- 兄弟間の並び順は日本語ロケール（`Collator`）でのプロジェクト名昇順。

## Bottom ナビゲーション

- タブ: ホーム / プロジェクト / 企業 / 設定
- 各タブは対応する Screen のルートに遷移。
- タブ切り替え時は `popUpTo(startDestination)` でスタックを整理し、`launchSingleTop = true` で重複遷移を防ぐ。
- タブ切り替え時はデータを常に再取得するため、`saveState` / `restoreState` は使用しない。

## 遷移フロー（代表例）

1. **ログイン画面（右上歯車アイコン）** → `Screen.ApiSettings` へ遷移。戻る時は `popBackStack()`
2. **ログイン成功** → `Screen.Home` へ `popUpTo(Login) { inclusive = true }`
2. **ホーム** → プロジェクトタップ → `ProjectDetail.createRoute(id)`  
   → チケット一覧 → `ProjectIssues.createRoute(projectId)`  
   → チケットタップ → `IssueDetail.createRoute(issueId)`  
   → 編集 → `IssueEdit.createRoute(issueId)`  
   → 保存後 → `popBackStack()`
3. **チケットタブ** → 新規作成 → `IssueCreate.createRoute(projectId)`（projectId は null 可）  
   → 保存成功 → `IssueDetail.createRoute(issueId)` へ `popUpTo(IssueCreate) { inclusive = true }`
4. **プロジェクト詳細** → カンバン → `Kanban.createRoute(projectId)`  
   → Wiki → `WikiList.createRoute(projectId)`  
   → ページ → `WikiDetail.createRoute(projectId, pageId)`
5. **作業時間** → 新規 → `TimeCreate.createRoute(projectId)`  
   → 保存後 → `popBackStack()`
6. **企業一覧** → 企業タップ → `CompanyDetail.createRoute(companyId)`
   → 企業詳細内のタブ（横スクロール可能）: 概要 / 連絡先 / 商談 / 活動履歴 / Wiki / コメント / 拠点
   → 左下 FAB（名刺スキャン）タップ → `BusinessCardScan.route` → スキャン結果一覧 + 名刺情報表示
7. **設定** → ログアウト → `Screen.Login` へ `popUpTo(0) { inclusive = true }`

## 画面一覧（コンポーネント対応）

| Screen | コンポーネント | 概要 |
|--------|----------------|------|
| Login | LoginScreen | ログイン。成功時 onLoginSuccess。右上歯車アイコンで ApiSettings へ遷移 |
| ApiSettings | ApiSettingsScreen | API URL 設定のみ。ログイン前から利用可 |
| Register | RegisterScreen | 登録。成功時 onRegisterSuccess、戻る onNavigateBack |
| Home | HomeScreen | ホーム。プロジェクト/チケットへの導線 |
| Projects | ProjectListScreen | プロジェクト一覧（**親子ツリー表示**）。タップで ProjectDetail |
| Issues | IssueListScreen | チケット一覧（projectId なし）。タップで IssueDetail、新規で IssueCreate |
| Time | TimeEntriesScreen | 工数一覧。新規で TimeEntryFormScreen（TimeCreate） |
| Companies | CompanyListScreen | 企業一覧。タップで CompanyDetail |
| Settings | SettingsScreen | API URL・ログアウト |
| ProjectDetail | ProjectDetailScreen | プロジェクト詳細。Issues/Kanban/Wiki への導線 |
| ProjectIssues | IssueListScreen | プロジェクト紐付けチケット一覧 |
| IssueDetail | IssueDetailScreen | チケット詳細。編集で IssueEdit |
| IssueCreate / IssueEdit | IssueFormScreen | チケット新規・編集 |
| Kanban | KanbanScreen | カンバン |
| WikiList | WikiListScreen | Wiki 一覧。タップで WikiDetail |
| WikiDetail | WikiDetailScreen | Wiki ページ表示 |
| CompanyDetail | CompanyDetailScreen | 企業詳細（タブ: 概要 / 連絡先 / 商談 / 活動履歴 / Wiki / コメント / 拠点） |
| TimeCreate | TimeEntryFormScreen | 工数登録 |
| BusinessCardScan | BusinessCardScanScreen | 名刺スキャン。起動直後は BusinessCardGuideScreen（CameraX ライブプレビュー＋輝度・距離リアルタイムガイド）を表示し、「スキャン開始」タップ後に ML Kit Document Scanner でスキャン。各ページを一覧表示し ML Kit Text Recognition (Japanese) で OCR → BusinessCardParser で名刺情報を抽出して表示。右下「スキャン追加」FAB でさらに名刺を追記可能（FAB はガイド画面をスキップして直接スキャン） |

## 認証待ち

- NavGraph で `authUiState.isCheckingAuth` が true の間は CircularProgressIndicator を表示し、NavHost は描画しない。`isLoggedIn` に応じて startDestination を `Home` または `Login` に設定。
