# Frontend データモデル（型定義概要）

正定義は `frontend/src/types/index.ts` です。API レスポンスおよび画面で利用する型の概要です。

## 認証・ユーザー

- **User** — id, email, firstName, lastName, role, isAdmin, landingPage, show*Menu, createdAt, groupMembers, status（`pending` \| `active` \| `inactive`）, **permissions**（`Record<string, PermissionEntry>`）等。
- **PermissionEntry** — `{ canUse: boolean, canInput: boolean }`。
- **PermissionResource** — id, code, name, resourceType, parentId, position, children?。
- **PermissionSet** — id, name, description, createdAt, groups?, permissions?。
- **PermissionSetPermission** — resourceId, resource?, canUse, canInput。
- **Group** — id, name, createdAt, permissionSetId?, permissionSet?, _count, members。

## 会社・CRM

- **Company** — id, name, 住所系（postalCode, prefecture, city, street, building）, phone, fax, website, notes, legalEntityStatusId, legalEntityStatus, legalEntityPosition, createdAt, _count, projects, locations, contacts, associations, comments, wikiPages。
- **PaginatedCompaniesResponse** — `GET /api/companies?page=…` 用。`items`（Company[]）, `total`, `page`, `pageSize`, `totalPages`。
- **Association**, **LegalEntityStatus**, **Location** — 会社・団体・法人区分・拠点。
- **Contact** — id, companyId, firstName, lastName, notes, company, details, deals, _count。
- **PaginatedContactsResponse** — `GET /api/crm/contacts?page=…` 用。`items`（Contact[]）, `total`, `page`, `pageSize`, `totalPages`。
- **ContactDetail** — 担当者詳細（department, position, phone, email, locationId, isPrimary）。
- **ContactComment**, **CompanyComment** — コメント＋user, attachments。**CompanyComment** は活動のファイル用のとき `linkedActivity?: { id, subject }`（API の紐づけ活動）を含み得る。
- **Deal** — 商談（companyId, contactId, name, amount, status, probability, expectedCloseDate, assignedToId, notes 等）。
- **Activity** — CRM アクティビティ（`type`, subject, description, dueDate, completed, `contactId`・`contact`, `assignedToId`・`assignedTo`, `dealId`・`deal`, **`projects`**（`{ id, name, identifier }[]`、N:N）, **`fileCommentId`**, **`fileComment`**＝`{ id, attachments: Attachment[] } | null` 等）。`type` の標準値は [API_SPEC.md](../backend/API_SPEC.md) の Activity.type（`call`〜`claim`）を参照。
- **CompanyWikiPage** — 会社 Wiki（title, content, parentId, position, children）。

## プロジェクト

- **Project** — id, name, identifier, description, status, companyId, locationId, contactId, parentId, dueDate, remarks, createdAt, company, location, contact, parent, children, members, groups, relatedCompanies, _count。
- **ProjectMember** — userId, roles, user。**ProjectMemberRole** — roleId, role, sourceGroupId。
- **ProjectGroup** — groupId, group。
- **ProjectRelatedCompany** — projectId, companyId, locationId, contactId, remarks, company, location, contact。
- **ProjectComment** — projectId, userId, content, user, attachments。

## チケット

- **Tracker**, **IssueStatus**, **IssuePriority** — マスタ（id, name, position 等）。
- **Role** — id, name, position, isDefaultRole, statuses, transitions。
- **Issue** — id, projectId, trackerId, statusId, priorityId, authorId, assignedToId, assignedToGroupId, subject, description, parentId（親チケット）, startDate, endDate（終了日時）, dueDate（期日）, estimatedHours, doneRatio, createdAt, updatedAt, project, tracker, status, priority, author, assignedTo, assignedToGroup, parent（`{ id, subject }`）, children（子の要約配列または `_count.children`）, comments, attachments, timeEntries, relationsFrom, relationsTo, _count。子を持つ場合 `startDate` / `endDate` / `status`（statusId）は子孫から集約した表示値（ステータスは position 最小）。
- **IssueRelation** — issueFromId, issueToId, relationType, issueFrom, issueTo。
- **IssueComment** — issueId, userId, content, user, attachments。
- **IssueMetaOptions** — trackers, statuses, priorities, users, groups（チケット作成/編集用メタ）。

## Wiki・添付・工数

- **WikiPage** — id, projectId, title, content, authorId, parentId, position, author, project, children。
- **Attachment** — id, filename, contentType, fileSize, filePath, 紐づきID（projectId, issueId, issueCommentId 等）, authorId, createdAt, author。
- **TimeEntry** — id, projectId, issueId, userId, hours, activity, spentOn, comments, project, issue, user。

## 保存済み検索

- **SavedSearch** — id, userId, viewMode（`list` | `gantt` | `kanban` | `time`）, name, isDefault, filter（`SavedSearchFilter`）, createdAt, updatedAt。
- **SavedSearchFilter** — `projectFilter?`（ProjectFilterCriteria）, `issueFilter?`（IssueFilterCriteria）, `ganttZoom?`（`day`|`month`|`year`）, `showEmptyProjects?`（boolean。ガントでチケットなしプロジェクトを表示するか。省略時は true）, `ganttStartValue?`, `ganttEndValue?`, `timeRecordStartDate?`, `timeRecordEndDate?`, `timeRecordFilterUserIds?`（(number|string)[]）。

## システム

- **SystemSetting** — id, startTime, endTime, managementTimes, conversionTimes。メール関連: emailTransport（`ses` \| `smtp`）, emailFromOverride, smtpHost, smtpPort, smtpUser, smtpSecure（API の GET ではパスワードは含めず `smtpPasswordSet` を別途返す）。
- **EmailSettings（API 応答）** — GET `/admin/settings/email`: emailTransport, emailFromOverride, smtpHost, smtpPort, smtpUser, smtpSecure, smtpPasswordSet。

## 注意

- 日付は API から ISO 8601 文字列で渡る想定。`createdAt`, `updatedAt`, `dueDate`, `spentOn` 等は string で扱う。
- オプショナル・ネストは API の include に依存するため、フロントでは optional chaining で参照すること。
