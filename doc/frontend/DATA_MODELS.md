# Frontend データモデル（型定義概要）

正定義は `frontend/src/types/index.ts` です。API レスポンスおよび画面で利用する型の概要です。

## 認証・ユーザー

- **User** — id, email, firstName, lastName, role, isAdmin, landingPage, show*Menu, createdAt, groupMembers, status（`pending` \| `active` \| `inactive`）, **authMethod**（`password` \| `sso`）, **microsoftLinked**（boolean）, **permissions**（`Record<string, PermissionEntry>`）等。
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

- **Project** — id, name, identifier, description, status, companyId, locationId, contactId, parentId, dueDate, remarks, createdAt, company, location, contact, parent, children, members, groups, relatedCompanies, **myPermissions**（当該ユーザーのロール権限マップ。詳細 GET 時）, _count。
- **ProjectMember** — userId, roles, user。**ProjectMemberRole** — roleId, role, sourceGroupId。
- **ProjectGroup** — groupId, group。
- **ProjectRelatedCompany** — projectId, companyId, locationId, contactId, remarks, company, location, contact。
- **ProjectComment** — projectId, userId, content, user, attachments。

## チケット

- **Tracker**, **IssueStatus**, **IssuePriority** — マスタ（id, name, position 等）。
- **Role** — id, name, position, isDefaultRole, statuses, transitions, permissions（プロジェクト詳細の RolePermission）。
- **Issue** — id, projectId, trackerId, statusId, priorityId, authorId, assignedToId, assignedToGroupId, subject, description, parentId（親チケット）, startDate, endDate（終了日時）, dueDate（期日）, estimatedHours, doneRatio, createdAt, updatedAt, project, tracker, status, priority, author, assignedTo, assignedToGroup, parent（`{ id, subject }`）, children（子の要約配列または `_count.children`）, comments, attachments, timeEntries, relationsFrom, relationsTo, _count。子を持つ場合 `startDate` / `endDate` / `status`（statusId）は子孫から集約した表示値（ステータスは position 最小）。`project` は `GET /` 応答では `company: { id, name } | null` を含む場合がある（一覧・カンバン・時間表示での「企業名 / プロジェクト名」形式表示用）。
- **IssueRelation** — issueFromId, issueToId, relationType, issueFrom, issueTo。
- **IssueComment** — issueId, userId, content, user, attachments。
- **IssueMetaOptions** — trackers, statuses, priorities, users, groups（チケット作成/編集用メタ）。`projectId` 指定時は **workflow**（`assignableStatusIds`, `allowedTransitions`）を含む。

## Wiki・添付・工数

- **WikiPage** — id, projectId, title, content, authorId, parentId, position, author, project, children。
- **Attachment** — id, filename, contentType, fileSize, filePath, 紐づきID（projectId, issueId, issueCommentId 等）, authorId, createdAt, author。
- **TimeEntry** — id, projectId, issueId, userId, hours, activity, spentOn, comments, project, issue, user。

## フィルタ条件（プロジェクト一覧）

- **DateRangeSpecifyMode** — `relative`（相対指定）| `direct`（直接指定）。
- **DateRangeRelativePreset** — グループ付き相対期間。今日周辺: `today` / `tomorrow` / `yesterday`。直近・将来: `last7Days`（直近7日間・今日含む）/ `last30Days`（直近30日間・今日含む）/ `next7Days`（今後7日間・今日〜+6日）。週単位: `thisWeek`（月〜日）/ `nextWeek` / `lastWeek`。月単位: `thisMonth`（1日〜末日）/ `nextMonth` / `lastMonth`。年度単位: `thisFiscalYear`（6月〜翌3月）/ `lastFiscalYear`（前年度）。
- **ProjectFilterCriteria** — `searchQuery`, `dueDateStart`, `dueDateEnd`, `dueDateMode`, `dueDateRelative`, `companyIds`, `statuses`。
- **IssueFilterCriteria** — `trackerIds`, `statusIds`, `assignedToIds`, `assignedToGroupIds`, `assignedToGroupMemberIds`, `dueDateStart`, `dueDateEnd`, `dueDateMode`, `dueDateRelative`（チケット期限。ガント／カンバン等）, `scheduleDateStart`, `scheduleDateEnd`, `scheduleDateMode`, `scheduleDateRelative`（チケット開始日〜終了日との期間重なり。主に時間タブ）。相対指定時は対応する `*Mode`=`relative` と `*Relative` プリセットを保持し、絞り込み時に日付範囲を再計算する。

## 保存済み検索

- **SavedSearch** — id, userId, viewMode（`list` | `gantt` | `kanban` | `time`）, name, isDefault, filter（`SavedSearchFilter`）, createdAt, updatedAt。
- **SavedSearchFilter** — `projectFilter?`（ProjectFilterCriteria）, `issueFilter?`（IssueFilterCriteria）, `ganttZoom?`（`day`|`month`|`year`）, `showEmptyProjects?`（boolean。ガントでチケットなしプロジェクトを表示するか。省略時は true）, `ganttStartValue?`, `ganttEndValue?`, `timeRecordStartDate?`, `timeRecordEndDate?`, `timeRecordDateMode?`, `timeRecordDateRelative?`, `timeRecordFilterUserIds?`（(number|string)[]）, `listSort?`（`{ key, direction, emptyPlacement? }[]`。一覧の複合並び替え。`key` は `companyName`|`name`|`identifier`|`dueDate`|`issueCount`|`status`、`direction` は `asc`|`desc`、`emptyPlacement` は省略可能な項目向けに `first`|`last`（未設定値の位置。省略時は末尾）。省略時は適用しない）。日付範囲条件の保存: **相対指定**では `*Mode` / `*Relative` のみを保存し開始・終了日付は保存しない（適用時に再計算）。**直接指定**では `*Mode`=`direct` とともに開始・終了日付も保存する。

## システム

- **SystemSetting** — id, startTime, endTime, managementTimes, conversionTimes。メール関連: emailTransport（`ses` \| `smtp`）, emailFromOverride, smtpHost, smtpPort, smtpUser, smtpSecure（API の GET ではパスワードは含めず `smtpPasswordSet` を別途返す）。休日関連は `HolidaySettings` を参照。
- **EmailSettings（API 応答）** — GET `/admin/settings/email`: emailTransport, emailFromOverride, smtpHost, smtpPort, smtpUser, smtpSecure, smtpPasswordSet。
- **HolidayDateEntry** — `{ date: string`（`YYYY-MM-DD`）, `name: string }`。
- **HolidaySettings（API 応答）** — GET `/admin/settings/holidays`: `holidayWeekdays`（number[]、0=日〜6=土）, `holidays`（HolidayDateEntry[]）, `workdays`（HolidayDateEntry[]）。
- **WorkCalendarSettings（API 応答）** — GET `/settings/calendar`: 時間設定（startTime, endTime, managementTimes, conversionTimes）＋休日設定（holidayWeekdays, holidays, workdays）。ガント等の参照専用。

## 注意

- 日付は API から ISO 8601 文字列で渡る想定。`createdAt`, `updatedAt`, `dueDate`, `spentOn` 等は string で扱う。
- オプショナル・ネストは API の include に依存するため、フロントでは optional chaining で参照すること。
