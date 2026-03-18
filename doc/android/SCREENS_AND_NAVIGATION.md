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
  - `CompanyDetail` — `company/{companyId}`
  - `TimeCreate` — `time/create?projectId={projectId}`（projectId は任意）
  - `BusinessCardScan` — `company/business_card_scan`（名刺スキャン画面）

## 新規作成ダイアログ（FAB）

以下の画面では Scaffold に FloatingActionButton（＋）を配置し、タップでダイアログを表示する。

| 画面 | ダイアログ | フィールド |
|------|-----------|-----------|
| ProjectListScreen | プロジェクト登録 | 名前*, 識別子*, 企業, 親プロジェクト, 期限日, 説明 |
| CompanyListScreen | 会社登録（右下 FAB: Add） | 会社名*, 法人格, 法人格前後（前/後）, 郵便番号, 電話番号, 都道府県, 市区町村, 番地, 建物名, Webサイト, 備考 |
| CompanyListScreen | 名刺スキャン（左下 FAB: DocumentScanner） | ML Kit Document Scanner を起動（マルチページ）→ BusinessCardScanScreen へ遷移 |
| CompanyDetailScreen（連絡先タブ） | 連絡先登録 | 姓*, 名*, 部署, 役職, 電話, メール, メモ |
| CompanyDetailScreen（商談タブ） | 商談登録 | 商談名*, ステータス, 金額, 確度, 見込み日, メモ |
| CompanyDetailScreen（活動履歴タブ） | 活動登録 | 種別*（電話/メール/訪問/会議/メモ）, 件名*, 内容, 関連連絡先, 期日 |
| CompanyDetailScreen（拠点タブ） | 拠点登録 | 拠点名*, 郵便番号, 電話番号, 都道府県, 市区町村, 番地, 建物名, 備考 |

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
| Projects | ProjectListScreen | プロジェクト一覧。タップで ProjectDetail |
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
| BusinessCardScan | BusinessCardScanScreen | 名刺スキャン。ML Kit Document Scanner でスキャン後、各ページを一覧表示し ML Kit Text Recognition (Japanese) で OCR → BusinessCardParser で名刺情報を抽出して表示 |

## 認証待ち

- NavGraph で `authUiState.isCheckingAuth` が true の間は CircularProgressIndicator を表示し、NavHost は描画しない。`isLoggedIn` に応じて startDestination を `Home` または `Login` に設定。
