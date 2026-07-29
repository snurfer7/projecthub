import { Project } from '../types';

export type ProjectTreeDisplayRow = {
  project: Project;
  depth: number;
  hasChildren: boolean;
};

export type ProjectListSortKey =
  | 'companyName'
  | 'name'
  | 'identifier'
  | 'dueDate'
  | 'issueCount'
  | 'status';

export type ProjectListSortDirection = 'asc' | 'desc';

/** 省略値（未設定）の配置 */
export type ProjectListEmptyPlacement = 'first' | 'last';

export type ProjectListSort = {
  key: ProjectListSortKey;
  direction: ProjectListSortDirection;
  /** 省略値の位置。省略可能な項目のみ有効。既定は末尾 */
  emptyPlacement?: ProjectListEmptyPlacement;
};

export const PROJECT_LIST_SORT_OPTIONS: {
  key: ProjectListSortKey;
  label: string;
  /** 未設定があり得る項目（企業名・期限） */
  optional?: boolean;
}[] = [
  { key: 'companyName', label: '企業名', optional: true },
  { key: 'name', label: 'プロジェクト名' },
  { key: 'identifier', label: '識別子' },
  { key: 'dueDate', label: '期限', optional: true },
  { key: 'issueCount', label: 'チケット数' },
  { key: 'status', label: 'ステータス' },
];

export const DEFAULT_PROJECT_LIST_SORT: ProjectListSort[] = [
  { key: 'name', direction: 'asc' },
];

export function isOptionalSortKey(key: ProjectListSortKey): boolean {
  return PROJECT_LIST_SORT_OPTIONS.some((o) => o.key === key && o.optional);
}

export function createSortEntry(
  key: ProjectListSortKey,
  direction: ProjectListSortDirection = 'asc',
): ProjectListSort {
  if (isOptionalSortKey(key)) {
    return { key, direction, emptyPlacement: 'last' };
  }
  return { key, direction };
}

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  closed: 1,
  archived: 2,
};

function compareByName(a: Project, b: Project): number {
  return a.name.localeCompare(b.name, 'ja');
}

/** 省略値の比較。両方値ありなら null（通常比較へ） */
function compareEmpty(
  aHas: boolean,
  bHas: boolean,
  placement: ProjectListEmptyPlacement,
): number | null {
  if (aHas && bHas) return null;
  if (!aHas && !bHas) return 0;
  if (!aHas) return placement === 'last' ? 1 : -1;
  return placement === 'last' ? -1 : 1;
}

function emptyPlacementOf(sort: ProjectListSort): ProjectListEmptyPlacement {
  return sort.emptyPlacement === 'first' ? 'first' : 'last';
}

function compareNullableString(
  aVal: string | null | undefined,
  bVal: string | null | undefined,
  sort: ProjectListSort,
): number {
  const emptyCmp = compareEmpty(!!aVal, !!bVal, emptyPlacementOf(sort));
  if (emptyCmp != null) return emptyCmp;
  return aVal!.localeCompare(bVal!, 'ja') * (sort.direction === 'asc' ? 1 : -1);
}

/** 単一キーでの比較（等しい場合は 0。名前フォールバックなし） */
function compareBySortKey(a: Project, b: Project, sort: ProjectListSort): number {
  const dir = sort.direction === 'asc' ? 1 : -1;
  let cmp = 0;

  switch (sort.key) {
    case 'companyName':
      return compareNullableString(a.company?.name, b.company?.name, sort);
    case 'name':
      cmp = a.name.localeCompare(b.name, 'ja');
      break;
    case 'identifier':
      cmp = a.identifier.localeCompare(b.identifier, 'ja');
      break;
    case 'dueDate': {
      const emptyCmp = compareEmpty(!!a.dueDate, !!b.dueDate, emptyPlacementOf(sort));
      if (emptyCmp != null) return emptyCmp;
      cmp = a.dueDate!.localeCompare(b.dueDate!);
      break;
    }
    case 'issueCount':
      cmp = (a._count?.issues ?? 0) - (b._count?.issues ?? 0);
      break;
    case 'status':
      cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      break;
    default:
      return 0;
  }

  return cmp * dir;
}

function compareProjectsBySorts(a: Project, b: Project, sorts: ProjectListSort[]): number {
  for (const sort of sorts) {
    const cmp = compareBySortKey(a, b, sort);
    if (cmp !== 0) return cmp;
  }
  return compareByName(a, b);
}

/** 同一親配下（またはルート同士）の兄弟を listSort で並べ替え */
export function sortSiblingProjects(
  projects: Project[],
  sorts: ProjectListSort[] | undefined,
): Project[] {
  const effective =
    sorts && sorts.length > 0 ? sorts : DEFAULT_PROJECT_LIST_SORT;
  return [...projects].sort((a, b) => compareProjectsBySorts(a, b, effective));
}

/** @deprecated 互換用。sortSiblingProjects を使用 */
export function sortRootProjects(
  projects: Project[],
  sorts: ProjectListSort[] | undefined,
): Project[] {
  return sortSiblingProjects(projects, sorts);
}

/** フィルタ済みプロジェクトを親子階層の表示行に並べる（折りたたみ対応） */
export function buildProjectTreeDisplayRows(
  projects: Project[],
  collapsedIds: Set<number>,
  sort?: ProjectListSort | ProjectListSort[],
): ProjectTreeDisplayRow[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const siblingSorts: ProjectListSort[] = !sort
    ? DEFAULT_PROJECT_LIST_SORT
    : Array.isArray(sort)
      ? sort.length > 0
        ? sort
        : DEFAULT_PROJECT_LIST_SORT
      : [sort];

  const childrenMap = new Map<number, Project[]>();
  for (const project of projects) {
    if (project.parentId != null && byId.has(project.parentId)) {
      const list = childrenMap.get(project.parentId) ?? [];
      list.push(project);
      childrenMap.set(project.parentId, list);
    }
  }
  for (const [, list] of childrenMap) {
    list.sort((a, b) => compareProjectsBySorts(a, b, siblingSorts));
  }
  const roots = projects
    .filter((p) => p.parentId == null || !byId.has(p.parentId))
    .sort((a, b) => compareProjectsBySorts(a, b, siblingSorts));

  const result: ProjectTreeDisplayRow[] = [];
  const visited = new Set<number>();

  const markDescendantsVisited = (id: number) => {
    for (const child of childrenMap.get(id) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      markDescendantsVisited(child.id);
    }
  };

  const visit = (project: Project, depth: number) => {
    if (visited.has(project.id)) return;
    visited.add(project.id);
    const children = childrenMap.get(project.id) ?? [];
    result.push({
      project,
      depth,
      hasChildren: children.length > 0,
    });
    if (collapsedIds.has(project.id)) {
      // 折りたたみ中の子孫を orphan フォールバックで再表示しない
      markDescendantsVisited(project.id);
      return;
    }
    children.forEach((child) => visit(child, depth + 1));
  };

  roots.forEach((root) => visit(root, 0));
  projects.forEach((p) => {
    if (!visited.has(p.id)) visit(p, 0);
  });
  return result;
}

/**
 * チケットがあるプロジェクト、およびその祖先を残す（チケットなしの末端は除外）。
 * ガントの「チケットなしプロジェクト非表示」時の件数・表示対象に使う。
 */
export function filterProjectsKeepingAncestorsOfTicketed(
  projects: Project[],
  projectIdsWithIssues: Set<number>,
): Project[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const childrenMap = new Map<number, number[]>();
  for (const project of projects) {
    if (project.parentId != null && byId.has(project.parentId)) {
      const list = childrenMap.get(project.parentId) ?? [];
      list.push(project.id);
      childrenMap.set(project.parentId, list);
    }
  }

  const keep = new Set<number>();
  const visited = new Set<number>();
  const markKeep = (id: number): boolean => {
    if (visited.has(id)) return keep.has(id);
    visited.add(id);
    if (!byId.has(id)) return false;
    let childKept = false;
    for (const childId of childrenMap.get(id) ?? []) {
      if (markKeep(childId)) childKept = true;
    }
    if (projectIdsWithIssues.has(id) || childKept) {
      keep.add(id);
      return true;
    }
    return false;
  };
  projects.forEach((p) => markKeep(p.id));
  return projects.filter((p) => keep.has(p.id));
}

/**
 * 親プロジェクト選択など Combobox 用の表示名パーツ。
 * - secondary: 企業名 + 祖先プロジェクト（上段・グレー小）
 * - primary: 当該プロジェクト名（下段）
 * 企業名は当該プロジェクト優先、未設定なら祖先を辿る。
 */
export function getProjectSelectLabelParts(
  project: Project,
  allProjects: Project[] | Map<number, Project>,
): { primary: string; secondary: string } {
  const byId =
    allProjects instanceof Map
      ? allProjects
      : new Map(allProjects.map((p) => [p.id, p]));

  const chain: Project[] = [];
  const seen = new Set<number>();
  let current: Project | undefined = project;
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    chain.unshift(current);
    const parentId = current.parentId;
    current = parentId != null ? byId.get(parentId) : undefined;
  }

  const primary = project.name;
  const ancestors = chain.slice(0, -1);
  const companyName = [...chain].reverse().find((p) => p.company?.name)?.company?.name;
  const secondaryParts: string[] = [];
  if (companyName) secondaryParts.push(companyName);
  for (const ancestor of ancestors) {
    secondaryParts.push(ancestor.name);
  }
  return { primary, secondary: secondaryParts.join(' / ') };
}
