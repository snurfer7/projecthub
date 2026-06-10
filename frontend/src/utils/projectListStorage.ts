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
};

export function defaultPersistedProjectList(): Omit<PersistedProjectList, 'v'> {
  return {
    viewMode: 'list',
    projectFilter: defaultProjectFilterCriteria(),
    issueFilter: defaultIssueFilterCriteria(),
    ganttZoom: 'day',
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
  return {
    searchQuery: f.searchQuery,
    dueDateStart: f.dueDateStart,
    dueDateEnd: f.dueDateEnd,
    companyIds: f.companyIds,
  };
}

function parseAssignedToIds(f: Record<string, unknown>): (number | string)[] | null {
  if (Array.isArray(f.assignedToIds)) {
    return f.assignedToIds;
  }
  const legacy = f.assignedToId;
  if (legacy === '' || legacy == null) return [];
  if (typeof legacy === 'number') return [legacy];
  return null;
}

function parseIssueFilter(o: unknown): IssueFilterCriteria | null {
  if (!o || typeof o !== 'object') return null;
  const f = o as Record<string, unknown>;
  const trackerId = f.trackerId;
  const statusId = f.statusId;
  if (trackerId !== '' && typeof trackerId !== 'number') return null;
  if (statusId !== '' && typeof statusId !== 'number') return null;
  const assignedToIds = parseAssignedToIds(f);
  if (assignedToIds === null) return null;
  if (typeof f.dueDateStart !== 'string') return null;
  if (typeof f.dueDateEnd !== 'string') return null;
  return {
    trackerId: trackerId as number | '',
    statusId: statusId as number | '',
    assignedToIds,
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
