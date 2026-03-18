# Frontend データモデル（型定義概要）

正定義は `frontend/src/types/index.ts` です。API レスポンスおよび画面で利用する型の概要です。

## 認証・ユーザー

- **User** — id, email, firstName, lastName, role, isAdmin, landingPage, show*Menu, createdAt, groupMembers 等。
- **Group** — id, name, createdAt, _count, members。

## 会社・CRM

- **Company** — id, name, 住所系（postalCode, prefecture, city, street, building）, phone, fax, website, notes, legalEntityStatusId, legalEntityStatus, legalEntityPosition, createdAt, _count, projects, locations, contacts, associations, comments, wikiPages。
- **Association**, **LegalEntityStatus**, **Location** — 会社・団体・法人区分・拠点。
- **Contact** — id, companyId, firstName, lastName, notes, company, details, deals, _count。
- **ContactDetail** — 担当者詳細（department, position, phone, email, locationId, isPrimary）。
- **ContactComment**, **CompanyComment** — コメント＋user, attachments。
- **Deal** — 商談（companyId, contactId, name, amount, status, probability, expectedCloseDate, assignedToId, notes 等）。
- **Activity** — CRM アクティビティ（type, subject, description, dueDate, completed 等）。
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
- **Issue** — id, projectId, trackerId, statusId, priorityId, authorId, assignedToId, assignedToGroupId, subject, description, startDate, dueDate, estimatedHours, doneRatio, createdAt, updatedAt, project, tracker, status, priority, author, assignedTo, assignedToGroup, comments, attachments, timeEntries, relationsFrom, relationsTo, _count。
- **IssueRelation** — issueFromId, issueToId, relationType, issueFrom, issueTo。
- **IssueComment** — issueId, userId, content, user, attachments。
- **IssueMetaOptions** — trackers, statuses, priorities, users, groups（チケット作成/編集用メタ）。

## Wiki・添付・工数

- **WikiPage** — id, projectId, title, content, authorId, parentId, position, author, project, children。
- **Attachment** — id, filename, contentType, fileSize, filePath, 紐づきID（projectId, issueId, issueCommentId 等）, authorId, createdAt, author。
- **TimeEntry** — id, projectId, issueId, userId, hours, activity, spentOn, comments, project, issue, user。

## システム

- **SystemSetting** — id, startTime, endTime, managementTimes, conversionTimes。

## 注意

- 日付は API から ISO 8601 文字列で渡る想定。`createdAt`, `updatedAt`, `dueDate`, `spentOn` 等は string で扱う。
- オプショナル・ネストは API の include に依存するため、フロントでは optional chaining で参照すること。
