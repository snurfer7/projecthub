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
}

export interface Company {
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
  createdAt: string;
  _count?: { projects: number; comments: number; wikiPages: number; locations: number };
  projects?: { id: number; name: string; identifier: string; status: string }[];
  locations?: Location[];
  contacts?: Contact[];
  associations?: { id: number; association: Association }[];
  comments?: CompanyComment[];
  wikiPages?: CompanyWikiPage[];
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
  createdAt: string;
}

export interface Location {
  id: number;
  companyId: number;
  name: string;
  phone?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  street?: string;
  building?: string;
  notes?: string;
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
  user: { id: number; firstName: string; lastName: string; email?: string };
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
  subject: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  doneRatio: number;
  createdAt: string;
  updatedAt: string;
  project?: { id: number; name: string };
  tracker?: Tracker;
  status?: IssueStatus;
  priority?: IssuePriority;
  author?: { id: number; firstName: string; lastName: string };
  assignedTo?: { id: number; firstName: string; lastName: string } | null;
  assignedToGroup?: { id: number; name: string } | null;
  comments?: IssueComment[];
  attachments?: Attachment[];
  timeEntries?: TimeEntry[];
  relationsFrom?: IssueRelation[];
  relationsTo?: IssueRelation[];
  _count?: { comments: number };
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
  type: string;
  subject: string;
  description?: string;
  dueDate?: string | null;
  completed: boolean;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string };
  contact?: { id: number; firstName: string; lastName: string } | null;
  deal?: { id: number; name: string } | null;
}

export interface IssueMetaOptions {
  trackers: Tracker[];
  statuses: IssueStatus[];
  priorities: IssuePriority[];
  users: { id: number; firstName: string; lastName: string }[];
  groups?: { id: number; name: string }[];
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
}
