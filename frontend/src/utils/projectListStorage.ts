import {
  defaultProjectFilterCriteria,
  type ProjectFilterCriteria,
} from './projectFilter';
import { defaultIssueFilterCriteria, type IssueFilterCriteria } from './issueFilter';

export const PROJECT_LIST_STORAGE_KEY = 'projecthub.projectList.v1';

export const PROJECT_LIST_RESET_EVENT = 'projecthub:project-list-reset';

export type ProjectListViewMode = 'list' | 'gantt' | 'kanban' | 'time';

export type PersistedProjectList = {
  v: 1;
  viewMode: ProjectListViewMode;
  projectFilter: ProjectFilterCriteria;
  issueFilter: IssueFilterCriteria;
  ganttZoom: 'day' | 'month' | 'year';
  /** ガント: チケットなしのプロジェクトを表示するか */
  showEmptyProjects: boolean;
};

export function defaultPersistedProjectList(): Omit<PersistedProjectList, 'v'> {
  return {
    viewMode: 'list',
    projectFilter: defaultProjectFilterCriteria(),
    issueFilter: defaultIssueFilterCriteria(),
    ganttZoom: 'day',
    showEmptyProjects: true,
  };
}

function isViewMode(v: unknown): v is ProjectListViewMode {
  return v === 'list' || v === 'gantt' || v === 'kanban' || v === 'time';
}

function isGanttZoom(v: unknown): v is 'day' | 'month' | 'year' {
  return v === 'day' || v === 'month' || v === 'year';
}

function parseProjectFilter(o: unknown): ProjectFilterCriteria | null {
  if (!o || typeof o !== 'object') return null;
  const f = o as Record<string, unknown>;
  if (typeof f.searchQuery !== 'string') return null;
  if (typeof f.dueDateStart !== 'string') return null;
  if (typeof f.dueDateEnd !== 'string') return null;
  if (!Array.isArray(f.companyIds)) return null;
  const statuses = Array.isArray(f.statuses) ? (f.statuses as string[]) : [];
  return {
    searchQuery: f.searchQuery,
    dueDateStart: f.dueDateStart,
    dueDateEnd: f.dueDateEnd,
    companyIds: f.companyIds,
    statuses,
  };
}

function parseIdListField(
  f: Record<string, unknown>,
  pluralKey: string,
  singularKey: string,
): (number | string)[] | null {
  if (Array.isArray(f[pluralKey])) {
    return f[pluralKey] as (number | string)[];
  }
  const legacy = f[singularKey];
  if (legacy === '' || legacy == null) return [];
  if (typeof legacy === 'number') return [legacy];
  return null;
}

function parseIssueFilter(o: unknown): IssueFilterCriteria | null {
  if (!o || typeof o !== 'object') return null;
  const f = o as Record<string, unknown>;
  const trackerIds = parseIdListField(f, 'trackerIds', 'trackerId');
  const statusIds = parseIdListField(f, 'statusIds', 'statusId');
  const assignedToIds = parseIdListField(f, 'assignedToIds', 'assignedToId');
  if (trackerIds === null || statusIds === null || assignedToIds === null) return null;
  if (typeof f.dueDateStart !== 'string') return null;
  if (typeof f.dueDateEnd !== 'string') return null;
  const assignedToGroupIds = Array.isArray(f.assignedToGroupIds)
    ? (f.assignedToGroupIds as (number | string)[])
    : [];
  const assignedToGroupMemberIds = Array.isArray(f.assignedToGroupMemberIds)
    ? (f.assignedToGroupMemberIds as (number | string)[])
    : [];
  return {
    trackerIds,
    statusIds,
    assignedToIds,
    assignedToGroupIds,
    assignedToGroupMemberIds,
    dueDateStart: f.dueDateStart,
    dueDateEnd: f.dueDateEnd,
  };
}

export function readPersistedProjectList(): Omit<PersistedProjectList, 'v'> | null {
  try {
    const raw = sessionStorage.getItem(PROJECT_LIST_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PersistedProjectList;
    if (o?.v !== 1) return null;
    if (!isViewMode(o.viewMode)) return null;
    const projectFilter = parseProjectFilter(o.projectFilter);
    const issueFilter = parseIssueFilter(o.issueFilter);
    if (!projectFilter || !issueFilter) return null;
    if (!isGanttZoom(o.ganttZoom)) return null;
    return {
      viewMode: o.viewMode,
      projectFilter,
      issueFilter,
      ganttZoom: o.ganttZoom,
      showEmptyProjects: typeof o.showEmptyProjects === 'boolean' ? o.showEmptyProjects : true,
    };
  } catch {
    return null;
  }
}

/** ヘッダー「プロジェクト」から一覧へ入るとき: 保存を消し、既に一覧表示中なら UI も初期化する */
export function clearProjectListPersistedFromHeader(): void {
  try {
    sessionStorage.removeItem(PROJECT_LIST_STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(PROJECT_LIST_RESET_EVENT));
}
