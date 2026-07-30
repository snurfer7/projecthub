import type { DateRangeRelativePreset, DateRangeSpecifyMode } from '../utils/dateRangeSpecify';

export type { DateRangeRelativePreset, DateRangeSpecifyMode };

export interface PermissionEntry {
  canUse: boolean;
  canInput: boolean;
}

export type PermissionMap = Record<string, PermissionEntry>;

export interface PermissionResource {
  id: number;
  code: string;
  name: string;
  resourceType: string;
  scope?: 'group' | 'role';
  position: number;
  children?: PermissionResource[];
}

export interface PermissionSetPermission {
  id?: number;
  resourceId: number;
  canUse: boolean;
  canInput: boolean;
  resource?: { id: number; code: string; name: string; resourceType: string };
}

export interface PermissionSet {
  id: number;
  name: string;
  description?: string | null;
  createdAt?: string;
  groups?: { id: number; name: string }[];
  permissions?: PermissionSetPermission[];
  _count?: { groups: number; permissions: number };
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isAdmin: boolean;
  landingPage: string;
  createdAt?: string;
  groupMembers?: { group: { id: number; name: string } }[];
  showProjectsMenu: boolean;
  showGanttMenu: boolean;
  showCompanyMenu: boolean;
  showAdminMenu: boolean;
  status: string;
  authMethod?: 'password' | 'sso';
  microsoftLinked?: boolean;
  permissions?: PermissionMap;
}

export interface Company {
  id: number;
  name: string;
  website?: string;
  notes?: string;
  legalEntityStatusId?: number;
  legalEntityStatus?: LegalEntityStatus;
  legalEntityPosition?: string;
  createdAt: string;
  _count?: { projects: number; comments: number; wikiPages: number; locations: number };
  projects?: { id: number; name: string; identifier: string; status: string }[];
  locations?: Location[];
  contacts?: Contact[];
  associations?: { id: number; association: Association }[];
  comments?: CompanyComment[];
  wikiPages?: CompanyWikiPage[];
}

/** GET /companies?page=… のレスポンス */
export interface PaginatedCompaniesResponse {
  items: Company[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Association {
  id: number;
  name: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  street?: string;
  building?: string;
  phone?: string;
  website?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface LegalEntityStatus {
  id: number;
  name: string;
  position: number;
  createdAt: string;
}

export interface Location {
  id: number;
  companyId: number;
  name: string;
  phone?: string;
  fax?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  street?: string;
  building?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  isProfileDisplay: boolean;
  createdAt: string;
}

export interface ProjectRelatedCompany {
  id?: number;
  projectId: number;
  companyId: number;
  locationId?: number | null;
  contactId?: number | null;
  remarks?: string | null;
  company?: { id: number; name: string } | null;
  location?: { id: number; name: string } | null;
  contact?: { id: number; firstName: string; lastName: string; email?: string; phone?: string } | null;
}

export interface Project {
  id: number;
  name: string;
  identifier: string;
  description?: string;
  status: string;
  companyId?: number;
  locationId?: number | null;
  contactId?: number | null;
  parentId?: number | null;
  dueDate?: string | null;
  remarks?: string | null;
  createdAt: string;
  company?: { id: number; name: string } | null;
  location?: { id: number; name: string } | null;
  contact?: { id: number; firstName: string; lastName: string; email?: string; phone?: string } | null;
  parent?: { id: number; name: string } | null;
  children?: Project[];
  members?: ProjectMember[];
  groups?: ProjectGroup[];
  relatedCompanies?: ProjectRelatedCompany[];
  myPermissions?: PermissionMap;
  _count?: { issues: number; wikiPages?: number; attachments?: number; timeEntries?: number; comments?: number };
}

export interface ProjectMemberRole {
  id: number;
  projectMemberId: number;
  roleId: number;
  sourceGroupId?: number | null;
  role: { id: number; name: string; position: number };
}

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  roles: ProjectMemberRole[];
  user: { id: number; firstName: string; lastName: string; email?: string; status?: string };
}

export interface ProjectGroup {
  id: number;
  projectId: number;
  groupId: number;
  group: { id: number; name: string };
}

export interface Tracker {
  id: number;
  name: string;
  position: number;
}

export interface Role {
  id: number;
  name: string;
  position: number;
  isDefaultRole: boolean;
  statuses?: { id: number; statusId: number; status: IssueStatus }[];
  transitions?: { oldStatusId: number; newStatusId: number }[];
  permissions?: PermissionSetPermission[];
}

export interface IssueStatus {
  id: number;
  name: string;
  isClosed: boolean;
  position: number;
}

export interface IssuePriority {
  id: number;
  name: string;
  position: number;
}

export interface Issue {
  id: number;
  projectId: number;
  trackerId: number;
  statusId: number;
  priorityId: number;
  authorId: number;
  assignedToId?: number;
  assignedToGroupId?: number;
  parentId?: number | null;
  subject: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  doneRatio: number;
  createdAt: string;
  updatedAt: string;
  project?: { id: number; name: string; company?: { id: number; name: string } | null };
  tracker?: Tracker;
  status?: IssueStatus;
  priority?: IssuePriority;
  author?: { id: number; firstName: string; lastName: string };
  assignedTo?: { id: number; firstName: string; lastName: string } | null;
  assignedToGroup?: { id: number; name: string } | null;
  parent?: { id: number; subject: string } | null;
  children?: { id: number; subject: string; startDate?: string | null; endDate?: string | null; dueDate?: string | null; parentId?: number | null }[];
  comments?: IssueComment[];
  attachments?: Attachment[];
  timeEntries?: TimeEntry[];
  relationsFrom?: IssueRelation[];
  relationsTo?: IssueRelation[];
  _count?: { comments?: number; children?: number };
}

export interface IssueRelation {
  id: number;
  issueFromId: number;
  issueToId: number;
  relationType: string;
  createdAt: string;
  issueFrom?: Partial<Issue>;
  issueTo?: Partial<Issue>;
}

export interface IssueComment {
  id: number;
  issueId: number;
  userId: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string };
  attachments?: Attachment[];
}

export interface WikiPage {
  id: number;
  projectId: number;
  title: string;
  content: string;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  author: { id: number; firstName: string; lastName: string };
  project?: { id: number; name: string };
  parentId?: number | null;
  position?: number;
  children?: WikiPage[];
}

export interface Attachment {
  id: number;
  filename: string;
  contentType: string;
  fileSize: number;
  filePath: string;
  projectId?: number;
  issueId?: number;
  issueCommentId?: number;
  projectCommentId?: number;
  companyCommentId?: number;
  contactCommentId?: number;
  authorId: number;
  createdAt: string;
  author: { id: number; firstName: string; lastName: string };
}

export interface TimeEntry {
  id: number;
  projectId: number;
  issueId?: number;
  userId: number;
  hours: number;
  activity: string;
  spentOn: string;
  comments?: string;
  createdAt: string;
  project?: { id: number; name: string };
  issue?: { id: number; subject: string } | null;
  user: { id: number; firstName: string; lastName: string };
}

export interface Group {
  id: number;
  name: string;
  createdAt: string;
  permissionSetId?: number | null;
  permissionSet?: { id: number; name: string } | null;
  _count?: { members: number };
  members?: { id: number; userId: number; user: { id: number; firstName: string; lastName: string; email: string } }[];
}

export interface Contact {
  id: number;
  companyId: number;
  firstName: string;
  lastName: string;
  notes?: string;
  createdAt: string;
  company: Company;
  details?: ContactDetail[];
  deals?: Deal[];
  _count?: { comments: number };
}

/** GET /crm/contacts?page=… のレスポンス */
export interface PaginatedContactsResponse {
  items: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** GET /crm/deals?page=… のレスポンス */
export interface PaginatedDealsResponse {
  items: Deal[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContactComment {
  id: number;
  contactId: number;
  userId: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string };
  attachments?: Attachment[];
}

export interface ContactDetail {
  id: number;
  contactId: number;
  department?: string;
  position?: string;
  phone?: string;
  email?: string;
  locationId?: number | null;
  location?: { id: number; name: string } | null;
  isPrimary: boolean;
}

export interface Deal {
  id: number;
  companyId: number;
  contactId?: number | null;
  name: string;
  amount?: number | null;
  status: string;
  probability?: number | null;
  expectedCloseDate?: string | null;
  assignedToId?: number | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: number; name: string };
  contact?: { id: number; firstName: string; lastName: string } | null;
  assignedTo?: { id: number; firstName: string; lastName: string } | null;
  activities?: Activity[];
}

export interface Activity {
  id: number;
  companyId: number;
  contactId?: number | null;
  dealId?: number | null;
  userId: number;
  assignedToId?: number | null;
  fileCommentId?: number | null;
  /** ファイル用会社コメントと添付メタ（GET/POST/PUT 活動 API） */
  fileComment?: {
    id: number;
    attachments: Pick<Attachment, 'id' | 'filename' | 'contentType' | 'fileSize'>[];
  } | null;
  type: string;
  subject: string;
  description?: string;
  dueDate?: string | null;
  completed: boolean;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string };
  assignedTo?: { id: number; firstName: string; lastName: string } | null;
  contact?: { id: number; firstName: string; lastName: string } | null;
  deal?: { id: number; name: string } | null;
  /** N:N で紐づくプロジェクト一覧 */
  projects?: { id: number; name: string; identifier: string }[];
  company?: { id: number; name: string } | null;
}

export interface IssueMetaWorkflow {
  assignableStatusIds: number[];
  /** null = any transition to an assignable status is allowed */
  allowedTransitions: { oldStatusId: number; newStatusId: number }[] | null;
}

export interface IssueMetaOptions {
  trackers: Tracker[];
  statuses: IssueStatus[];
  priorities: IssuePriority[];
  users: { id: number; firstName: string; lastName: string; status: string }[];
  groups?: { id: number; name: string }[];
  workflow?: IssueMetaWorkflow;
}

export interface ProjectComment {
  id: number;
  projectId: number;
  userId: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; email?: string };
  attachments?: Attachment[];
}

export interface CompanyComment {
  id: number;
  companyId: number;
  userId: number;
  content: string;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; email?: string };
  attachments?: Attachment[];
  linkedActivity?: { id: number; subject: string } | null;
}

export interface CompanyWikiPage {
  id: number;
  companyId: number;
  title: string;
  content: string;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  author: { id: number; firstName: string; lastName: string };
  parentId?: number | null;
  position?: number;
  children?: CompanyWikiPage[];
}

export interface SystemSetting {
  id: string;
  startTime: string;
  endTime: string;
  managementTimes: string[];
  conversionTimes: number[];
  holidayWeekdays?: number[];
  holidays?: HolidayDateEntry[];
  workdays?: HolidayDateEntry[];
}

export type ProjectListViewMode = 'list' | 'gantt' | 'kanban' | 'time';

export interface SavedSearchFilter {
  projectFilter?: {
    searchQuery: string;
    companyIds: (number | string)[];
    statuses: string[];
    dueDateStart?: string;
    dueDateEnd?: string;
    dueDateMode?: DateRangeSpecifyMode;
    dueDateRelative?: DateRangeRelativePreset | '';
  };
  issueFilter?: {
    trackerIds: (number | string)[];
    statusIds: (number | string)[];
    assignedToIds: (number | string)[];
    assignedToGroupIds: (number | string)[];
    assignedToGroupMemberIds: (number | string)[];
    dueDateStart?: string;
    dueDateEnd?: string;
    dueDateMode?: DateRangeSpecifyMode;
    dueDateRelative?: DateRangeRelativePreset | '';
    /** チケット開始日〜終了日との期間重なり（時間タブ） */
    scheduleDateStart?: string;
    scheduleDateEnd?: string;
    scheduleDateMode?: DateRangeSpecifyMode;
    scheduleDateRelative?: DateRangeRelativePreset | '';
  };
  ganttZoom?: 'day' | 'month' | 'year';
  /** ガント: チケットなしのプロジェクトを表示するか（省略時 true） */
  showEmptyProjects?: boolean;
  timeRecordStartDate?: string;
  timeRecordEndDate?: string;
  timeRecordDateMode?: DateRangeSpecifyMode;
  timeRecordDateRelative?: DateRangeRelativePreset | '';
  timeRecordFilterUserIds?: (number | string)[];
  /** 一覧: 複合並び替え（ルートのみ。省略時は既存の並びを維持） */
  listSort?: {
    key: string;
    direction: 'asc' | 'desc';
    /** 省略値の位置（企業名・期限など。省略時は末尾） */
    emptyPlacement?: 'first' | 'last';
  }[];
}

export interface SavedSearch {
  id: number;
  userId: number;
  viewMode: ProjectListViewMode;
  name: string;
  isDefault: boolean;
  filter: SavedSearchFilter;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/settings/email */
export interface EmailSettings {
  emailTransport: 'ses' | 'smtp';
  emailFromOverride: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpSecure: boolean;
  smtpPasswordSet: boolean;
}

/** 個別休日・出勤日（YYYY-MM-DD + 名称） */
export interface HolidayDateEntry {
  date: string;
  name: string;
}

/** GET /admin/settings/holidays — holidayWeekdays: 0=日〜6=土 */
export interface HolidaySettings {
  holidayWeekdays: number[];
  holidays: HolidayDateEntry[];
  workdays: HolidayDateEntry[];
}

/** GET /settings/calendar — 営業時間＋休日（ガント等の参照用） */
export interface WorkCalendarSettings {
  startTime: string;
  endTime: string;
  managementTimes: string[];
  conversionTimes: number[];
  holidayWeekdays: number[];
  holidays: HolidayDateEntry[];
  workdays: HolidayDateEntry[];
}
