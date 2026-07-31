import { Issue } from '../types';
import { formatIssueAssignees } from './issueAssignees';

export type IssueListSortKey =
  | 'id'
  | 'subject'
  | 'tracker'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'startDate'
  | 'endDate'
  | 'assignee';

export type IssueListSortDirection = 'asc' | 'desc';

/** 省略値（未設定）の配置 */
export type IssueListEmptyPlacement = 'first' | 'last';

export type IssueListSort = {
  key: IssueListSortKey;
  direction: IssueListSortDirection;
  /** 省略値の位置。省略可能な項目のみ有効。既定は末尾 */
  emptyPlacement?: IssueListEmptyPlacement;
};

export const ISSUE_LIST_SORT_OPTIONS: {
  key: IssueListSortKey;
  label: string;
  /** 未設定があり得る項目 */
  optional?: boolean;
}[] = [
  { key: 'id', label: 'ID' },
  { key: 'subject', label: '件名' },
  { key: 'tracker', label: 'トラッカー' },
  { key: 'status', label: 'ステータス' },
  { key: 'priority', label: '優先度' },
  { key: 'dueDate', label: '期日', optional: true },
  { key: 'startDate', label: '開始日', optional: true },
  { key: 'endDate', label: '終了日', optional: true },
  { key: 'assignee', label: '担当者', optional: true },
];

export const DEFAULT_ISSUE_LIST_SORT: IssueListSort[] = [
  { key: 'id', direction: 'asc' },
];

export function isOptionalIssueSortKey(key: IssueListSortKey): boolean {
  return ISSUE_LIST_SORT_OPTIONS.some((o) => o.key === key && o.optional);
}

export function createIssueSortEntry(
  key: IssueListSortKey,
  direction: IssueListSortDirection = 'asc',
): IssueListSort {
  if (isOptionalIssueSortKey(key)) {
    return { key, direction, emptyPlacement: 'last' };
  }
  return { key, direction };
}

/** 省略値の比較。両方値ありなら null（通常比較へ） */
function compareEmpty(
  aHas: boolean,
  bHas: boolean,
  placement: IssueListEmptyPlacement,
): number | null {
  if (aHas && bHas) return null;
  if (!aHas && !bHas) return 0;
  if (!aHas) return placement === 'last' ? 1 : -1;
  return placement === 'last' ? -1 : 1;
}

function emptyPlacementOf(sort: IssueListSort): IssueListEmptyPlacement {
  return sort.emptyPlacement === 'first' ? 'first' : 'last';
}

function compareNullableString(
  aVal: string | null | undefined,
  bVal: string | null | undefined,
  sort: IssueListSort,
): number {
  const emptyCmp = compareEmpty(!!aVal, !!bVal, emptyPlacementOf(sort));
  if (emptyCmp != null) return emptyCmp;
  return aVal!.localeCompare(bVal!, 'ja') * (sort.direction === 'asc' ? 1 : -1);
}

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function compareBySortKey(a: Issue, b: Issue, sort: IssueListSort): number {
  const dir = sort.direction === 'asc' ? 1 : -1;
  let cmp = 0;

  switch (sort.key) {
    case 'id':
      cmp = a.id - b.id;
      break;
    case 'subject':
      cmp = a.subject.localeCompare(b.subject, 'ja');
      break;
    case 'tracker':
      cmp =
        (a.tracker?.position ?? 0) - (b.tracker?.position ?? 0) ||
        (a.tracker?.name ?? '').localeCompare(b.tracker?.name ?? '', 'ja') ||
        a.trackerId - b.trackerId;
      break;
    case 'status':
      cmp =
        (a.status?.position ?? 0) - (b.status?.position ?? 0) ||
        (a.status?.name ?? '').localeCompare(b.status?.name ?? '', 'ja') ||
        a.statusId - b.statusId;
      break;
    case 'priority':
      cmp =
        (a.priority?.position ?? 0) - (b.priority?.position ?? 0) ||
        (a.priority?.name ?? '').localeCompare(b.priority?.name ?? '', 'ja') ||
        a.priorityId - b.priorityId;
      break;
    case 'dueDate':
      return compareNullableString(dateKey(a.dueDate), dateKey(b.dueDate), sort);
    case 'startDate':
      return compareNullableString(dateKey(a.startDate), dateKey(b.startDate), sort);
    case 'endDate':
      return compareNullableString(dateKey(a.endDate), dateKey(b.endDate), sort);
    case 'assignee': {
      const aLabel = formatIssueAssignees(a);
      const bLabel = formatIssueAssignees(b);
      return compareNullableString(aLabel || null, bLabel || null, sort);
    }
    default:
      return 0;
  }

  return cmp * dir;
}

function compareIssuesBySorts(a: Issue, b: Issue, sorts: IssueListSort[]): number {
  for (const sort of sorts) {
    const cmp = compareBySortKey(a, b, sort);
    if (cmp !== 0) return cmp;
  }
  return a.id - b.id;
}

function effectiveSorts(sorts: IssueListSort[] | undefined): IssueListSort[] {
  return sorts && sorts.length > 0 ? sorts : DEFAULT_ISSUE_LIST_SORT;
}

/** 同一親配下（またはルート同士）の兄弟を issueSort で並べ替え */
export function sortSiblingIssues(
  issues: Issue[],
  sorts: IssueListSort[] | undefined,
): Issue[] {
  const effective = effectiveSorts(sorts);
  return [...issues].sort((a, b) => compareIssuesBySorts(a, b, effective));
}

/** 親子階層を維持したまま兄弟間で並び替え、深さ付きの表示順を返す */
export function orderIssuesHierarchically(
  issues: Issue[],
  sorts?: IssueListSort[],
): { issue: Issue; depth: number }[] {
  const effective = effectiveSorts(sorts);
  const byId = new Map(issues.map((i) => [i.id, i]));
  const childrenMap = new Map<number, Issue[]>();
  for (const issue of issues) {
    if (issue.parentId != null && byId.has(issue.parentId)) {
      const list = childrenMap.get(issue.parentId) ?? [];
      list.push(issue);
      childrenMap.set(issue.parentId, list);
    }
  }
  for (const [, list] of childrenMap) {
    list.sort((a, b) => compareIssuesBySorts(a, b, effective));
  }
  const roots = issues
    .filter((i) => i.parentId == null || !byId.has(i.parentId))
    .sort((a, b) => compareIssuesBySorts(a, b, effective));

  const result: { issue: Issue; depth: number }[] = [];
  const visited = new Set<number>();
  const visit = (issue: Issue, depth: number) => {
    if (visited.has(issue.id)) return;
    visited.add(issue.id);
    result.push({ issue, depth });
    (childrenMap.get(issue.id) ?? []).forEach((c) => visit(c, depth + 1));
  };
  roots.forEach((r) => visit(r, 0));
  issues.forEach((i) => {
    if (!visited.has(i.id)) visit(i, 0);
  });
  return result;
}
