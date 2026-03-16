# Android 画面・ナビゲーション仕様

## ルート定義（Screen sealed class）

- **認証**: `Login` (`login`), `Register` (`register`)
- **メイン（BottomNav）**: `Home` (`home`), `Projects` (`projects`), `Issues` (`issues`), `Time` (`time`), `Companies` (`companies`)
- **設定**: `Settings` (`settings`)
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

## Bottom ナビゲーション

- タブ: ホーム / プロジェクト / チケット / 作業時間 / 会社
- 各タブは対応する Screen のルートに遷移。設定は BottomBar の右端（Settings アイコン）で `Screen.Settings` に遷移。
- タブ切り替え時は `popUpTo(startDestination)` でスタックを整理し、`launchSingleTop` と `restoreState` で状態復元。

## 遷移フロー（代表例）

1. **ログイン成功** → `Screen.Home` へ `popUpTo(Login) { inclusive = true }`
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
6. **会社一覧** → 会社タップ → `CompanyDetail.createRoute(companyId)`
7. **設定** → ログアウト → `Screen.Login` へ `popUpTo(0) { inclusive = true }`

## 画面一覧（コンポーネント対応）

| Screen | コンポーネント | 概要 |
|--------|----------------|------|
| Login | LoginScreen | ログイン。成功時 onLoginSuccess |
| Register | RegisterScreen | 登録。成功時 onRegisterSuccess、戻る onNavigateBack |
| Home | HomeScreen | ホーム。プロジェクト/チケットへの導線 |
| Projects | ProjectListScreen | プロジェクト一覧。タップで ProjectDetail |
| Issues | IssueListScreen | チケット一覧（projectId なし）。タップで IssueDetail、新規で IssueCreate |
| Time | TimeEntriesScreen | 工数一覧。新規で TimeEntryFormScreen（TimeCreate） |
| Companies | CompanyListScreen | 会社一覧。タップで CompanyDetail |
| Settings | SettingsScreen | API URL・ログアウト |
| ProjectDetail | ProjectDetailScreen | プロジェクト詳細。Issues/Kanban/Wiki への導線 |
| ProjectIssues | IssueListScreen | プロジェクト紐付けチケット一覧 |
| IssueDetail | IssueDetailScreen | チケット詳細。編集で IssueEdit |
| IssueCreate / IssueEdit | IssueFormScreen | チケット新規・編集 |
| Kanban | KanbanScreen | カンバン |
| WikiList | WikiListScreen | Wiki 一覧。タップで WikiDetail |
| WikiDetail | WikiDetailScreen | Wiki ページ表示 |
| CompanyDetail | CompanyDetailScreen | 会社詳細 |
| TimeCreate | TimeEntryFormScreen | 工数登録 |

## 認証待ち

- NavGraph で `authUiState.isCheckingAuth` が true の間は CircularProgressIndicator を表示し、NavHost は描画しない。`isLoggedIn` に応じて startDestination を `Home` または `Login` に設定。
