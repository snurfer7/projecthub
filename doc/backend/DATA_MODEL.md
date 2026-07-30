# Backend データモデル（概要）

正定義は `backend/prisma/schema.prisma` です。ここではエンティティの役割と主要リレーションのみ記載します。

## 認証・ユーザー

- **User** — ユーザー。email, passwordHash, firstName, lastName, role, isAdmin, landingPage, show*Menu。**認証**: `authMethod`（`password` \| `sso`）, `microsoftOid`（Entra object id・ユニーク・任意）, `microsoftTenantId`（任意）。Microsoft 連携の主キーはメールではなく `microsoftOid`（UPN 変更後も継続）。SSO ログイン成功時（oid 一致）は `User.email` を Entra のログイン ID（UPN）へ自動同期する（他ユーザーと衝突時はスキップ）。GroupMember, ProjectMember, Issue（author/assignedTo）, TimeEntry, WikiPage, 各種 Comment 等と関連。**API アクセスはグループ経由の権限設定で制御**（`isAdmin` / `role=admin` でもバイパスしない）。
- **Group** — グループ。GroupMember で User と多対多。Issue の担当グループ、ProjectGroup、ProjectMemberRole の sourceGroup として使用。**`permissionSetId`（任意）** で PermissionSet を参照（1 グループ = 最大 1 権限設定）。
- **GroupMember** — Group と User の多対多中間。ユーザーは複数グループに所属可能。
- **PermissionResource** — 権限カタログ（機能・項目）。code（例: `projects.issues.fields.subject`）, name, resourceType（`feature` \| `field`）, parentId, position。親子ツリー構造。
- **PermissionSet** — 権限設定。name, description。**1 つの権限設定に複数 Group を割り当て可能**（Group.permissionSetId の 1:N）。初期 seed 時のみ「全権限」を自動作成する（起動時同期では作成しない）。
- **PermissionSetPermission** — 権限設定と PermissionResource の対応。canUse（使用可否）, canInput（入力可否）。`(permissionSetId, resourceId)` はユニーク。
- **デフォルトグループ** — 初期 seed 時のみ名前「デフォルト」の Group を作成し、「全権限」を割当・全ユーザーを所属させる。起動時や seed 再実行では再作成・再割当しない。

### 権限解決

1. ユーザーの所属グループ（GroupMember）を取得
2. 各グループの PermissionSet から PermissionSetPermission を取得
3. 複数 PermissionSet の権限を **OR 結合**
4. 親 resource の canUse=false → 子孫すべて拒否
5. グループ未所属、または全所属グループが権限設定未割当 → 全拒否

## マスタ（チケット・ワークフロー）

- **Tracker** — チケット種別（Bug, Feature 等）。
- **IssueStatus** — ステータス（Open, Closed 等）。isClosed, position。RoleStatus, WorkflowTransition と関連。
- **IssuePriority** — 優先度。
- **Role** — プロジェクト内ロール。RoleStatus（担当可能ステータス）、WorkflowTransition（遷移許可）と関連。
- **RoleStatus** — Role と IssueStatus の対応。
- **WorkflowTransition** — ロールごとの「旧ステータス → 新ステータス」の遷移許可。

## 会社・CRM

- **Company** — 会社。name, 住所系（postalCode, prefecture, city, street, building）, phone, fax, website, notes, legalEntityStatusId, legalEntityPosition。LegalEntityStatus, Location, Contact, Deal, CompanyComment, CompanyWikiPage, Project（主契約）, ProjectRelatedCompany と関連。**企業統合**（API）は統合元にぶら下がる上記リレーションの `company_id` を統合先へ一括更新し、統合元の `Company` を削除する（団体多対多の重複・会社 Wiki の `(companyId, title)` 一意制約はサーバー側で解消する）。統合元の **Location.name** は、統合先へ移すとき統合元の企業名を括弧付きで末尾に付与する。統合元の **Company.notes**（備考）は、空でない場合に統合先の **notes** へ空行区切りで追記する。
- **LegalEntityStatus** — 法人区分（マスタ）。
- **Location** — 会社の拠点。ContactDetail, ProjectRelatedCompany, Project と関連。
- **Contact** — 担当者。Company に属す。ContactDetail, Deal, Activity, ContactComment, Project, ProjectRelatedCompany と関連。
- **ContactDetail** — 担当者の詳細（部署・役職・連絡先・拠点）。Location と関連。
- **Association** — 団体（業界団体等）。CompanyAssociation で Company と多対多。
- **CompanyAssociation** — Company と Association の多対多。
- **Deal** — 商談。Company, Contact, User（assignedTo）, Activity と関連。
- **Activity** — CRM アクティビティ。`type`（文字列・活動種別。標準値は API_SPEC の Activity.type を参照）, subject, description, dueDate, completed 等。Company, Contact（**先方担当者**）, Deal, User（作成者 `user` / **自社担当者** `assignedTo`）, **fileComment**（Prisma リレーション）, **Project（N:N・`ActivityProject` 経由）**と関連。**`fileCommentId`（任意・ユニーク）** — 活動に紐づく「ファイル用」会社コメント。添付レコードは `Attachment.companyCommentId` でコメントと共有する。API 応答では `projects: { id, name, identifier }[]` を含む。
- **ActivityProject** — 活動とプロジェクトの中間テーブル（複合主キー `activityId` + `projectId`）。活動の `companyId` は、紐づく各プロジェクトの主企業または関連企業のいずれかであること（API で検証）。
- **CompanyComment** — 会社へのコメント。Attachment 可。活動のファイル用コメントの場合、API 応答に **紐づく活動**（`activityFileFor` 等、id・subject）を含め、コメント一覧から活動履歴へ辿れるようにする。
- **CompanyWikiPage** — 会社用 Wiki。親子階層（parentId）。
- **ContactComment** — コンタクトへのコメント。Attachment 可。

## プロジェクト・チケット・Wiki・工数

- **Project** — プロジェクト。identifier（ユニーク）, status, company/location/contact（主契約・拠点・担当）, parent（親プロジェクト）。Issue, WikiPage, TimeEntry, ProjectComment, ProjectMember, ProjectGroup, ProjectRelatedCompany, Attachment, **Activity（N:N・`ActivityProject` 経由）**と関連。
- **ProjectMember** — プロジェクトメンバー。User と Project の多対多。ProjectMemberRole でロールを持つ。
- **ProjectMemberRole** — メンバーのロール。Role と Group（sourceGroupId、グループ経由で付与した場合）と関連。
- **ProjectGroup** — プロジェクトに紐づくグループ。
- **ProjectRelatedCompany** — プロジェクトと関連会社（Company + Location + Contact の組み合わせ）。
- **Issue** — チケット。Project, Tracker, IssueStatus, IssuePriority, User（author, assignedTo）, Group（assignedToGroup）, IssueRelation, IssueComment, TimeEntry, Attachment と関連。**親子階層**（`parentId` → 同一プロジェクト内の親チケット。循環参照不可）。スケジュール用に `startDate`（開始日時）, `endDate`（終了日時）, `dueDate`（期日）, `estimatedHours`（予定工数）を持つ。**子チケットを持つ親チケット**の `startDate` / `endDate` は入力不可で、全子孫チケットの開始の最小・終了の最大を表示する。**ステータス**も入力不可で、子孫のステータスのうち `IssueStatus.position` が最小（一覧で一番上）のものを表示する（API 応答でも集約値を返す。DB 上の親自身の日時・ステータスは子がある場合更新しない）。ガントチャートのバーも同様に集約表示し、親バーのドラッグ／リサイズは不可。
- **IssueRelation** — チケット間関連。relationType（例: precedes）。
- **IssueComment** — チケットコメント。Attachment 可。
- **WikiPage** — プロジェクト Wiki。親子階層（parentId）。author, project と関連。
- **ProjectComment** — プロジェクトコメント。Attachment 可。
- **TimeEntry** — 工数。projectId, issueId（任意）, userId, hours, activity, spentOn, comments。

## 添付・その他

- **Attachment** — 添付ファイル。project, issue, issueComment, projectComment, companyComment, contactComment のいずれかに紐づく。author, filePath, contentType, fileSize 等。
- **HomePage** — ホームページの HTML 等コンテンツ（1 レコード想定）。
- **SystemSetting** — システム設定（id: "default"）。startTime, endTime, managementTimes, conversionTimes に加え、**メール**: `emailTransport`（`ses` \| `smtp`）, `emailFromOverride`（任意・送信元上書き）, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPasswordEnc`（暗号化済み）, `smtpSecure`（465 番相当の TLS 用）。**休日**: `holidayWeekdays`（Int[]。0=日〜6=土。該当曜日を休日とする。初期値 `[0, 6]`＝土日）, `holidays`（Json。`{ date: "YYYY-MM-DD", name: string }[]` の個別休日）, `workdays`（Json。同形式の個別出勤日。曜日休日・個別休日より優先して出勤扱い）。
- **SavedSearch** — 保存済み検索条件。userId, viewMode（`list` \| `gantt` \| `kanban` \| `time`）, name（名称）, isDefault（対象 viewMode のデフォルト、1 ユーザー × 1 viewMode = 最大 1 件）, filter（JSON。projectFilter・issueFilter・ganttZoom・showEmptyProjects・ganttStartValue・ganttEndValue・timeRecordStartDate・timeRecordEndDate・timeRecordFilterUserIds・listSort を含む）, createdAt, updatedAt。User と多対多（1 ユーザーが複数保存可能）。**isDefault の一意制約はアプリ層で管理**（デフォルト設定時に同一ユーザー × viewMode の他レコードを false にする）。

### PermissionResource 追加

| code | name | resourceType | 親 |
|------|------|--------------|-----|
| `projects.saved-searches` | 保存済み検索 | feature | `projects` |
| `projects.activities` | 活動履歴 | feature | `projects` |
| `projects.issues.fields.parent` | 親チケット | field | `projects.issues` |
| `settings.fields.authMethod` | 認証方式 | field | `settings` |
| `settings.fields.microsoftAccount` | Microsoft アカウント連携 | field | `settings` |
| `admin.holiday-settings` | 休日設定 | feature | `admin` |

## クライアントとの整合

- フロントエンドの `frontend/src/types/index.ts` および Android の `data/api/models/*.kt` の DTO は、上記 Prisma モデルおよび API のレスポンス形状に合わせること。
- 日付は API では ISO 8601 文字列で返す想定（Prisma の DateTime は JSON で文字列化される）。
