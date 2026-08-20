# Backend データモデル（概要）

正定義は `backend/prisma/schema.prisma` です。ここではエンティティの役割と主要リレーションのみ記載します。

## 認証・ユーザー

- **User** — ユーザー。email, passwordHash, firstName, lastName, role, isAdmin, landingPage, show*Menu。**認証**: `authMethod`（`password` \| `sso`）, `microsoftOid`（Entra object id・ユニーク・任意）, `microsoftTenantId`（任意）。Microsoft 連携の主キーはメールではなく `microsoftOid`（UPN 変更後も継続）。SSO ログイン成功時（oid 一致）は `User.email` を Entra のログイン ID（UPN）へ自動同期する（他ユーザーと衝突時はスキップ）。**`notificationChannel`**（`email` \| `teams` \| `off`。既定 `email`）— 作業通知の全体配信先。**`uiPreferences`（JSON）** — 個人 UI 設定。現状はガント左ペイン列（`gantt.columns`: key / visible / width の配列。順序＝表示順。`ticket` は非表示不可）。GroupMember, ProjectMember, Issue（author / **IssueAssignee 経由の担当**）, TimeEntry, WikiPage, 各種 Comment、**UserNotificationPreference** 等と関連。**API アクセスはグループ経由の権限設定で制御**（`isAdmin` / `role=admin` でもバイパスしない）。
- **UserNotificationPreference** — ユーザーごとの通知イベント ON/OFF。`userId` + `eventType`（ユニーク）、`enabled`。行が無い種別はカタログの初期値を使う。
- **Group** — グループ。GroupMember で User と多対多。Issue の担当グループ、ProjectGroup、ProjectMemberRole の sourceGroup として使用。**`permissionSetId`（任意）** で PermissionSet を参照（1 グループ = 最大 1 権限設定）。**`position`** は親を持たないグループ同士の表示順。**GroupHierarchy** で親子の多対多（1 グループが複数親・複数子を持てる。DAG。循環参照不可）。
- **GroupMember** — Group と User の多対多中間。ユーザーは複数グループに所属可能。**メンバーシップは親子階層を継承しない**（直接所属のみ）。
- **GroupHierarchy** — グループ親子の中間。`parentGroupId` + `childGroupId`（ユニーク）、**`position`**（同一親の下での兄弟順）。グループ削除時は Cascade。自己参照および循環（例: A→B→C→A）は API で拒否。
- **PermissionResource** — 権限カタログ（機能・項目）。code, name, resourceType（`feature` \| `field`）, **scope（`group` \| `role`）**, parentId, position。`projects` は group、配下（`projects.overview`＝プロジェクト情報 / `projects.members`＝メンバー / issues / fields 等）は role。
- **PermissionSet** — 権限設定（グループ向け）。name, description。**scope=group のリソースのみ**割当可能。
- **PermissionSetPermission** — 権限設定と PermissionResource の対応。canUse, canInput。
- **RolePermission** — ロールと PermissionResource（scope=role）の対応。canUse, canInput。
- **デフォルトグループ** — 初期 seed 時のみ名前「デフォルト」の Group を作成し、「全権限」を割当・全ユーザーを所属させる。起動時や seed 再実行では再作成・再割当しない。

### 権限解決

1. **グループ権限（PermissionSet）**: ユーザーの**直接所属**グループごとに有効権限を解決し、OR 結合。`PermissionResource.scope = group` のみ（例: トップレベル `projects`）。親 canUse=false → 子孫拒否（PermissionResource ツリー）。
   - **グループの有効権限**: 当該グループに `permissionSetId` がある → **その PermissionSet のみ**（親グループは見ない）。無い → 各親グループの有効権限を再帰解決して **OR 結合**。祖先にも未割当ならそのグループは寄与しない。
2. **ロール権限（RolePermission）**: プロジェクトの `ProjectMemberRole` → 各 Role の RolePermission を OR 結合。`scope = role`（例: `projects.issues`, `projects.issues.fields.*`）。プロジェクト単位で解決し、`GET /projects/:id` の `myPermissions` および API の `requireProjectPermission` で検証。`User.isAdmin` / `role=admin` では原則バイパスしない。**例外は 2 つのみ**:
   - **一覧の絞り込み**: プロジェクト一覧画面（一覧／ガント／カンバン／時間）の一覧系 API は、システム管理者に対してロール権限による絞り込みを行わない（`getListableProjectIds`）。ロール設定を誤って自分が締め出されたプロジェクトにも到達できるようにするため。
   - **`projects.members`**: システム管理者に use/input を付与する（メンバーの設定ミスを修正できるようにするため）。プロジェクト詳細のその他のタブ・項目は従来どおりロール権限が必要。
3. グループ未所属、または全所属グループの有効権限が空（直接・祖先とも PermissionSet 未割当）→ グループ権限は全拒否
4. プロジェクトにロール未割当 → ロール権限は全拒否

## マスタ（チケット・ワークフロー）

- **Tracker** — チケット種別（Bug, Feature 等）。
- **IssueStatus** — ステータス（新規, 進行中, 終了 等）。**isClosed**（終了フラグ。true のとき完了扱い。カンバン列・チケットバッジ等の表示に反映）, position。RoleStatus, WorkflowTransition と関連。
- **IssuePriority** — 優先度。
- **Role** — プロジェクト内ロール。RoleStatus、WorkflowTransition、**RolePermission**（プロジェクト詳細権限）と関連。`isDefaultRole` はメンバー／グループ追加時のロール選択の初期値（複数可）。プロジェクト作成時の作成者には全ロールを付与する。
- **RolePermission** — Role と PermissionResource（scope=role）の対応。canUse / canInput。
- **RoleStatus** — Role と IssueStatus の対応。「利用可能なステータス」。チケット作成時の初期ステータスおよび遷移先として設定可能な範囲をロール単位で制限する。
- **WorkflowTransition** — ロールごとの「旧ステータス → 新ステータス」の遷移許可。チケット更新・カンバン移動時に検証する。

### チケットステータス・ワークフローの解決

ユーザーがプロジェクト上で持つ `ProjectMemberRole` の各 Role について、RoleStatus / WorkflowTransition を **OR 結合**する（権限と同じ）。

| 対象 | ルール |
|------|--------|
| 利用可能ステータス | 各ロールの RoleStatus の和集合。RoleStatus が 0 件のロールは「全ステータス可」として寄与（未設定時の後方互換） |
| ステータス遷移 | 各ロールの WorkflowTransition の和集合。WorkflowTransition が 0 件のロールは「任意遷移可」として寄与。全ロールが未設定なら遷移制限なし。遷移先は利用可能ステータスに含まれること |
| ロール未割当 | ステータス設定・遷移いずれも不可 |
| 同一ステータス | 変更なしは常に許可 |

作成時は利用可能ステータスのみ検証。更新で `statusId` が変わる場合は遷移＋利用可能ステータスを検証。フィールド権限 `projects.issues.fields.status` も別途必要。

## 会社・CRM

- **Company** — 会社。name, 住所系（postalCode, prefecture, city, street, building）, phone, fax, website, notes, legalEntityStatusId, legalEntityPosition, **`isSales`（売上先・Boolean・既定 false）**, **`isPurchase`（仕入先・Boolean・既定 false）**。同一企業で売上先と仕入先の両方を true にできる。LegalEntityStatus, Location, Contact, Deal, CompanyComment, CompanyWikiPage, Project（主契約）, ProjectRelatedCompany と関連。**企業統合**（API）は統合元にぶら下がる上記リレーションの `company_id` を統合先へ一括更新し、統合元の `Company` を削除する（団体多対多の重複・会社 Wiki の `(companyId, title)` 一意制約はサーバー側で解消する）。統合元の **Location.name** は、統合先へ移すとき統合元の企業名を括弧付きで末尾に付与する。統合元の **Company.notes**（備考）は、空でない場合に統合先の **notes** へ空行区切りで追記する。**取引区分**は統合先へ OR で引き継ぐ（統合元が売上先／仕入先なら統合先も true にする）。
- **LegalEntityStatus** — 法人区分（マスタ）。
- **Location** — 会社の拠点。ContactDetail, ProjectRelatedCompany, Project と関連。
- **Contact** — 担当者。Company に属す。ContactDetail, Deal, Activity, ContactComment, Project, ProjectRelatedCompany と関連。
- **ContactDetail** — 担当者の詳細（部署・役職・連絡先・拠点）。Location と関連。
- **Association** — 団体（業界団体等）。CompanyAssociation で Company と多対多。
- **CompanyAssociation** — Company と Association の多対多。
- **Deal** — 商談。Company, Contact, User（assignedTo）, Activity と関連。
- **Activity** — CRM アクティビティ。`type`（文字列・活動種別。標準値は API_SPEC の Activity.type を参照）, subject, description, dueDate, completed 等。Company, **Location（拠点・任意）**, Contact（**先方担当者**）, Deal, User（作成者 `user` / **自社担当者** `assignedTo`）, **fileComment**（Prisma リレーション）, **Project（N:N・`ActivityProject` 経由）**と関連。**`locationId`（任意）** — 当該企業の拠点。**`fileCommentId`（任意・ユニーク）** — 活動に紐づく「ファイル用」会社コメント。添付レコードは `Attachment.companyCommentId` でコメントと共有する。API 応答では `projects: { id, name, identifier }[]` および `location: { id, name } | null` を含む。
- **ActivityProject** — 活動とプロジェクトの中間テーブル（複合主キー `activityId` + `projectId`）。活動の `companyId` は、紐づく各プロジェクトの主企業または関連企業のいずれかであること（API で検証）。
- **CompanyComment** — 会社へのコメント。Attachment 可。活動のファイル用コメントの場合、API 応答に **紐づく活動**（`activityFileFor` 等、id・subject）を含め、コメント一覧から活動履歴へ辿れるようにする。
- **CompanyWikiPage** — 会社用 Wiki。親子階層（parentId）。
- **ContactComment** — コンタクトへのコメント。Attachment 可。

## プロジェクト・チケット・Wiki・工数

- **Project** — プロジェクト。identifier（ユニーク）, status, company/location/contact（主契約・拠点・担当）, parent（親プロジェクト）。Issue, WikiPage, TimeEntry, ProjectComment, ProjectMember, ProjectGroup, ProjectRelatedCompany, Attachment, **Activity（N:N・`ActivityProject` 経由）**と関連。
- **ProjectMember** — プロジェクトへの**個別**メンバー割当。User と Project の多対多。ProjectMemberRole で個別ロールを持つ。グループ所属ユーザーはここに展開保存しない。
- **ProjectMemberRole** — 個別メンバーのロール（`sourceGroupId` は廃止方向・新規付与しない）。
- **ProjectGroup** — プロジェクトへのグループ割当。`groupId` と **`roleIds`（割当ロールの配列）** のみ保存。所属ユーザーは読み出し時に展開する。
- **プロジェクトの可視性（読取時展開）**: 次のいずれかで参照可能。(1) 個別 `ProjectMember` がある。(2) いずれかの `ProjectGroup` の `groupId` がユーザーの**カバレッジ集合**に含まれる。カバレッジ = 直接所属グループ ∪ それらの祖先。割当グループ `G` の実効メンバー = `G` 自身および子孫グループの直接所属ユーザー。ロール権限・ワークフローは個別ロール ∪ ヒットした各 `ProjectGroup.roleIds` を OR。PermissionSet の「グループ所属は階層継承しない」とは別（プロジェクト割当のみ子孫を含む）。**例外**: `User.isAdmin` は全プロジェクト参照可。作成者は作成時に個別メンバー（全ロール）として登録。**空割当防止**: 個別メンバーもグループ割当も 0 件になる場合、操作ユーザーを個別メンバー（全ロール）で自動追加する。
- **ProjectRelatedCompany** — プロジェクトと関連会社（Company + Location + Contact の組み合わせ）。
- **Issue** — チケット。Project, Tracker, IssueStatus, IssuePriority, User（author）, Group（**assignedToGroup**・担当グループ・任意・単一）, **IssueAssignee**（担当ユーザー・N:N）, IssueRelation, IssueComment, TimeEntry, Attachment と関連。インデックス: `parentId`, `projectId`。**担当者**は複数ユーザーを同時に割り当て可能（`IssueAssignee`）。担当グループ（`assignedToGroupId`）は従来どおり単一で、ユーザー担当と併用可。**親子階層**（`parentId` → 同一プロジェクト内の親チケット。循環参照不可）。**プロジェクト変更**（`PUT` で `projectId` 更新）: 当該チケットと全子孫を移動先へ一括移動し、移動対象ルートに親がある場合は `parentId` を解除（子孫同士の親子は維持）。紐づく `TimeEntry.projectId` も同トランザクションで同期。権限は移動元・移動先双方の `projects.issues` input と、移動元の field `projects.issues.fields.project`。スケジュール用に `startDate`（開始日時）, `endDate`（終了日時）, `dueDate`（期日）, `estimatedHours`（予定工数・`Float?`・0 以上・**0.5 刻み**）を持つ。**子チケットを持つ親チケット**の `startDate` / `endDate` は入力不可で、全子孫チケットの開始の最小・終了の最大を表示する。**ステータス**も入力不可で、子孫のステータスのうち `IssueStatus.position` が最小（一覧で一番上）のものを表示する（API 応答でも集約値を返す。DB 上の親自身の日時・ステータスは子がある場合更新しない）。ガントチャートのバーも同様に集約表示し、親バーのドラッグ／リサイズは不可。
- **IssueAssignee** — チケットと担当ユーザーの多対多（`issueId` + `userId` 複合主キー）。API 応答では `assignees: { id, firstName, lastName }[]` として展開する。
- **IssueRelation** — チケット間関連。relationType（例: precedes）。
- **IssueComment** — チケットコメント。Attachment 可。
- **WikiPage** — プロジェクト Wiki。親子階層（parentId）。author, project と関連。
- **ProjectComment** — プロジェクトコメント。Attachment 可。
- **TimeEntry** — 工数。projectId, issueId（任意）, userId, hours, activity, spentOn, comments。インデックス: `(projectId, spentOn)`, `issueId`, `userId`。ガント API はチケットごとに `hours` の合計を `actualHours` として返す（DB 列ではない計算値）。プロジェクト一覧の時間タブは `GET /api/time-tree` で個別行を返す。
- **Issue** — チケット。…（既存記述）

## 添付・その他

- **Attachment** — 添付ファイル。project, issue, issueComment, projectComment, companyComment, contactComment のいずれかに紐づく。author, filePath, contentType, fileSize 等。
- **HomePage** — ホームページの HTML 等コンテンツ（1 レコード想定）。
- **SystemSetting** — システム設定（id: "default"）。startTime, endTime, managementTimes, conversionTimes に加え、**メール**: `emailTransport`（`ses` \| `smtp`）, `emailFromOverride`（任意・送信元上書き）, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPasswordEnc`（暗号化済み）, `smtpSecure`（465 番相当の TLS 用）。**休日**: `holidayWeekdays`（Int[]。0=日〜6=土。該当曜日を休日とする。初期値 `[0, 6]`＝土日）, `holidays`（Json。`{ date: "YYYY-MM-DD", name: string }[]` の個別休日）, `workdays`（Json。同形式の個別出勤日。曜日休日・個別休日より優先して出勤扱い）。**通知**: `defaultNotificationChannel`（`email` \| `teams` \| `off`。新規ユーザー作成時の `User.notificationChannel` 初期値。未設定時は `email`）。チャンネル Webhook は持たない。
- **SavedSearch** — 保存済み検索条件。userId, viewMode（`list` \| `gantt` \| `kanban` \| `time`）, name（名称）, isDefault（対象 viewMode のデフォルト、1 ユーザー × 1 viewMode = 最大 1 件）, filter（JSON。projectFilter・issueFilter・ganttZoom・showEmptyProjects・ganttStartValue・ganttEndValue・timeRecordStartDate・timeRecordEndDate・timeRecordFilterUserIds（ユーザー ID および `g:{groupId}`）・listSort・issueSort を含む）, createdAt, updatedAt。User と多対多（1 ユーザーが複数保存可能）。**isDefault の一意制約はアプリ層で管理**（デフォルト設定時に同一ユーザー × viewMode の他レコードを false にする）。

### PermissionResource 追加

| code | name | resourceType | 親 |
|------|------|--------------|-----|
| `projects.saved-searches` | 保存済み検索 | feature / **scope=group** | `projects`（プロジェクト一覧向け。ロール対象外） |
| `projects.activities` | 活動履歴 | feature | `projects` |
| `projects.issues.fields.parent` | 親チケット | field | `projects.issues` |
| `projects.issues.fields.project` | プロジェクト | field | `projects.issues` |
| `settings.fields.authMethod` | 認証方式 | field | `settings` |
| `settings.fields.microsoftAccount` | Microsoft アカウント連携 | field | `settings` |
| `admin.holiday-settings` | 休日設定 | feature | `admin` |
| `admin.notification-settings` | 通知設定 | feature | `admin` |
| `admin.statuses.fields.isClosed` | 終了 | field | `admin.statuses` |
| `admin.groups.fields.parentGroups` | 親グループ | field | `admin.groups` |
| `admin.groups.fields.childGroups` | 子グループ | field | `admin.groups` |
| `companies.activities.fields.location` | 拠点 | field | `companies.activities` |
| `companies.fields.transactionTypes` | 取引区分 | field | `companies`（`isSales` / `isPurchase` をまとめて制御） |

## クライアントとの整合

- フロントエンドの `frontend/src/types/index.ts` および Android の `data/api/models/*.kt` の DTO は、上記 Prisma モデルおよび API のレスポンス形状に合わせること。
- 日付は API では ISO 8601 文字列で返す想定（Prisma の DateTime は JSON で文字列化される）。
