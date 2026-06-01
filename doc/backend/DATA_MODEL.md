# Backend データモデル（概要）

正定義は `backend/prisma/schema.prisma` です。ここではエンティティの役割と主要リレーションのみ記載します。

## 認証・ユーザー

- **User** — ユーザー。email, passwordHash, firstName, lastName, role, isAdmin（システム管理者フラグ）, landingPage, show*Menu。GroupMember, ProjectMember, Issue（author/assignedTo）, TimeEntry, WikiPage, 各種 Comment 等と関連。管理機能（`/api/admin`）へのアクセスは、role が admin であるか、isAdmin が true のいずれかで許可する。
- **Group** — グループ。GroupMember で User と多対多。Issue の担当グループ、ProjectGroup、ProjectMemberRole の sourceGroup として使用。
- **GroupMember** — Group と User の多対多中間。

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
- **Activity** — CRM アクティビティ。`type`（文字列・活動種別。標準値は API_SPEC の Activity.type を参照）, subject, description, dueDate, completed 等。Company, Contact（**先方担当者**）, Deal, User（作成者 `user` / **自社担当者** `assignedTo`）, **fileComment**（Prisma リレーション）と関連。**`fileCommentId`（任意・ユニーク）** — 活動に紐づく「ファイル用」会社コメント。API 応答では `fileComment.attachments` を含め、UI からダウンロード・削除に使う。添付レコードは `Attachment.companyCommentId` でコメントと共有する。
- **CompanyComment** — 会社へのコメント。Attachment 可。活動のファイル用コメントの場合、API 応答に **紐づく活動**（`activityFileFor` 等、id・subject）を含め、コメント一覧から活動履歴へ辿れるようにする。
- **CompanyWikiPage** — 会社用 Wiki。親子階層（parentId）。
- **ContactComment** — コンタクトへのコメント。Attachment 可。

## プロジェクト・チケット・Wiki・工数

- **Project** — プロジェクト。identifier（ユニーク）, status, company/location/contact（主契約・拠点・担当）, parent（親プロジェクト）。Issue, WikiPage, TimeEntry, ProjectComment, ProjectMember, ProjectGroup, ProjectRelatedCompany, Attachment と関連。
- **ProjectMember** — プロジェクトメンバー。User と Project の多対多。ProjectMemberRole でロールを持つ。
- **ProjectMemberRole** — メンバーのロール。Role と Group（sourceGroupId、グループ経由で付与した場合）と関連。
- **ProjectGroup** — プロジェクトに紐づくグループ。
- **ProjectRelatedCompany** — プロジェクトと関連会社（Company + Location + Contact の組み合わせ）。
- **Issue** — チケット。Project, Tracker, IssueStatus, IssuePriority, User（author, assignedTo）, Group（assignedToGroup）, IssueRelation, IssueComment, TimeEntry, Attachment と関連。スケジュール用に `startDate`（開始日時）, `endDate`（終了日時）, `dueDate`（期日）, `estimatedHours`（予定工数）を持つ。ガントチャートのバーは `startDate`〜`endDate` で表示する。
- **IssueRelation** — チケット間関連。relationType（例: precedes）。
- **IssueComment** — チケットコメント。Attachment 可。
- **WikiPage** — プロジェクト Wiki。親子階層（parentId）。author, project と関連。
- **ProjectComment** — プロジェクトコメント。Attachment 可。
- **TimeEntry** — 工数。projectId, issueId（任意）, userId, hours, activity, spentOn, comments。

## 添付・その他

- **Attachment** — 添付ファイル。project, issue, issueComment, projectComment, companyComment, contactComment のいずれかに紐づく。author, filePath, contentType, fileSize 等。
- **HomePage** — ホームページの HTML 等コンテンツ（1 レコード想定）。
- **SystemSetting** — システム設定（id: "default"）。startTime, endTime, managementTimes, conversionTimes に加え、**メール**: `emailTransport`（`ses` \| `smtp`）, `emailFromOverride`（任意・送信元上書き）, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPasswordEnc`（暗号化済み）, `smtpSecure`（465 番相当の TLS 用）。

## クライアントとの整合

- フロントエンドの `frontend/src/types/index.ts` および Android の `data/api/models/*.kt` の DTO は、上記 Prisma モデルおよび API のレスポンス形状に合わせること。
- 日付は API では ISO 8601 文字列で返す想定（Prisma の DateTime は JSON で文字列化される）。
