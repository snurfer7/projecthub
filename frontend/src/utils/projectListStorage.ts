import {
  defaultProjectFilterCriteria,
  type ProjectFilterCriteria,
} from './projectFilter';
import { defaultIssueFilterCriteria, type IssueFilterCriteria } from './issueFilter';
import {
  DEFAULT_PROJECT_LIST_SORT,
  createSortEntry,
  isOptionalSortKey,
  type ProjectListEmptyPlacement,
  type ProjectListSort,
  type ProjectListSortDirection,
  type ProjectListSortKey,
} from './projectTree';
import {
  DEFAULT_ISSUE_LIST_SORT,
  createIssueSortEntry,
  isOptionalIssueSortKey,
  type IssueListEmptyPlacement,
  type IssueListSort,
  type IssueListSortDirection,
  type IssueListSortKey,
} from './issueSort';
import {
  isDateRangeRelativePreset,
  isDateRangeSpecifyMode,
  type DateRangeRelativePreset,
  type DateRangeSpecifyMode,
} from './dateRangeSpecify';

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
  /** 一覧: 複合列ソート（ルートのみ・優先順） */
  listSort: ProjectListSort[];
  /** ガント／カンバン／時間: チケット複合並び替え */
  issueSort: IssueListSort[];
};

export function defaultPersistedProjectList(): Omit<PersistedProjectList, 'v'> {
  return {
    viewMode: 'list',
    projectFilter: defaultProjectFilterCriteria(),
    issueFilter: defaultIssueFilterCriteria(),
    ganttZoom: 'day',
    showEmptyProjects: true,
    listSort: [...DEFAULT_PROJECT_LIST_SORT],
    issueSort: [...DEFAULT_ISSUE_LIST_SORT],
  };
}

function isListSortKey(v: unknown): v is ProjectListSortKey {
  return (
    v === 'companyName' ||
    v === 'name' ||
    v === 'identifier' ||
    v === 'dueDate' ||
    v === 'issueCount' ||
    v === 'status'
  );
}

function isListSortDirection(v: unknown): v is ProjectListSortDirection {
  return v === 'asc' || v === 'desc';
}

function isEmptyPlacement(v: unknown): v is ProjectListEmptyPlacement {
  return v === 'first' || v === 'last';
}

function parseListSort(o: Record<string, unknown>): ProjectListSort[] {
  if (Array.isArray(o.listSort)) {
    const parsed: ProjectListSort[] = [];
    const seen = new Set<ProjectListSortKey>();
    for (const item of o.listSort) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      if (!isListSortKey(s.key) || !isListSortDirection(s.direction)) continue;
      if (seen.has(s.key)) continue;
      seen.add(s.key);
      const entry = createSortEntry(s.key, s.direction);
      if (isOptionalSortKey(s.key) && isEmptyPlacement(s.emptyPlacement)) {
        entry.emptyPlacement = s.emptyPlacement;
      }
      parsed.push(entry);
    }
    if (parsed.length > 0) return parsed;
  }
  // 旧形式（単一キー）からの移行
  if (isListSortKey(o.listSortKey) && isListSortDirection(o.listSortDirection)) {
    return [createSortEntry(o.listSortKey, o.listSortDirection)];
  }
  return [...DEFAULT_PROJECT_LIST_SORT];
}

function isIssueSortKey(v: unknown): v is IssueListSortKey {
  return (
    v === 'id' ||
    v === 'subject' ||
    v === 'tracker' ||
    v === 'status' ||
    v === 'priority' ||
    v === 'dueDate' ||
    v === 'startDate' ||
    v === 'endDate' ||
    v === 'assignee'
  );
}

function isIssueSortDirection(v: unknown): v is IssueListSortDirection {
  return v === 'asc' || v === 'desc';
}

function isIssueEmptyPlacement(v: unknown): v is IssueListEmptyPlacement {
  return v === 'first' || v === 'last';
}

function parseIssueSort(o: Record<string, unknown>): IssueListSort[] {
  if (!Array.isArray(o.issueSort)) return [...DEFAULT_ISSUE_LIST_SORT];
  const parsed: IssueListSort[] = [];
  const seen = new Set<IssueListSortKey>();
  for (const item of o.issueSort) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (!isIssueSortKey(s.key) || !isIssueSortDirection(s.direction)) continue;
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    const entry = createIssueSortEntry(s.key, s.direction);
    if (isOptionalIssueSortKey(s.key) && isIssueEmptyPlacement(s.emptyPlacement)) {
      entry.emptyPlacement = s.emptyPlacement;
    }
    parsed.push(entry);
  }
  return parsed.length > 0 ? parsed : [...DEFAULT_ISSUE_LIST_SORT];
}

function isViewMode(v: unknown): v is ProjectListViewMode {
  return v === 'list' || v === 'gantt' || v === 'kanban' || v === 'time';
}

function isGanttZoom(v: unknown): v is 'day' | 'month' | 'year' {
  return v === 'day' || v === 'month' || v === 'year';
}

function parseDateRangeMode(v: unknown): DateRangeSpecifyMode {
  return isDateRangeSpecifyMode(v) ? v : 'direct';
}

function parseDateRangeRelative(v: unknown): DateRangeRelativePreset | '' {
  return isDateRangeRelativePreset(v) ? v : '';
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
    dueDateMode: parseDateRangeMode(f.dueDateMode),
    dueDateRelative: parseDateRangeRelative(f.dueDateRelative),
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
  const scheduleDateStart = typeof f.scheduleDateStart === 'string' ? f.scheduleDateStart : '';
  const scheduleDateEnd = typeof f.scheduleDateEnd === 'string' ? f.scheduleDateEnd : '';
  return {
    trackerIds,
    statusIds,
    assignedToIds,
    assignedToGroupIds,
    assignedToGroupMemberIds,
    dueDateStart: f.dueDateStart,
    dueDateEnd: f.dueDateEnd,
    dueDateMode: parseDateRangeMode(f.dueDateMode),
    dueDateRelative: parseDateRangeRelative(f.dueDateRelative),
    scheduleDateStart,
    scheduleDateEnd,
    scheduleDateMode: parseDateRangeMode(f.scheduleDateMode),
    scheduleDateRelative: parseDateRangeRelative(f.scheduleDateRelative),
  };
}

export function readPersistedProjectList(): Omit<PersistedProjectList, 'v'> | null {
  try {
    const raw = sessionStorage.getItem(PROJECT_LIST_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PersistedProjectList & {
      listSortKey?: unknown;
      listSortDirection?: unknown;
    };
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
      listSort: parseListSort(o as unknown as Record<string, unknown>),
      issueSort: parseIssueSort(o as unknown as Record<string, unknown>),
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
