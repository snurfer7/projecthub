type AggregatableIssue = {
  id: number;
  parentId?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  dueDate?: Date | string | null;
  statusId?: number;
};

function toTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export type AggregatedParentFields = {
  startDate: Date | null;
  endDate: Date | null;
  statusId: number | null;
};

/**
 * 親チケットの表示用フィールドを子孫から集約する。
 * - startDate: 子孫の開始最小
 * - endDate: 子孫の終了（なければ dueDate）最大
 * - statusId: 子孫ステータスのうち IssueStatus.position が最小（一覧で一番上）のもの
 */
export function applyAggregatedParentFields<T extends AggregatableIssue>(
  issues: T[],
  statusPositionById: Map<number, number>
): T[] {
  if (issues.length === 0) return issues;

  const byId = new Map(issues.map((i) => [i.id, { ...i }]));
  const childrenByParent = new Map<number, number[]>();
  for (const issue of byId.values()) {
    if (issue.parentId != null && byId.has(issue.parentId)) {
      const list = childrenByParent.get(issue.parentId) ?? [];
      list.push(issue.id);
      childrenByParent.set(issue.parentId, list);
    }
  }

  const scheduleMemo = new Map<number, { start: number | null; end: number | null }>();
  const statusMemo = new Map<number, number | null>();

  const resolveSchedule = (id: number): { start: number | null; end: number | null } => {
    if (scheduleMemo.has(id)) return scheduleMemo.get(id)!;
    const children = childrenByParent.get(id);
    if (!children || children.length === 0) {
      const issue = byId.get(id)!;
      const start = toTime(issue.startDate);
      const end = toTime(issue.endDate) ?? toTime(issue.dueDate);
      const result = { start, end };
      scheduleMemo.set(id, result);
      return result;
    }

    let minStart: number | null = null;
    let maxEnd: number | null = null;
    for (const childId of children) {
      const child = resolveSchedule(childId);
      if (child.start != null && (minStart == null || child.start < minStart)) minStart = child.start;
      if (child.end != null && (maxEnd == null || child.end > maxEnd)) maxEnd = child.end;
      if (child.start == null && child.end != null && (minStart == null || child.end < minStart)) {
        minStart = child.end;
      }
      if (child.end == null && child.start != null && (maxEnd == null || child.start > maxEnd)) {
        maxEnd = child.start;
      }
    }
    const result = { start: minStart, end: maxEnd };
    scheduleMemo.set(id, result);
    return result;
  };

  const resolveStatusId = (id: number): number | null => {
    if (statusMemo.has(id)) return statusMemo.get(id)!;
    const children = childrenByParent.get(id);
    if (!children || children.length === 0) {
      const statusId = byId.get(id)?.statusId ?? null;
      statusMemo.set(id, statusId);
      return statusId;
    }

    let bestId: number | null = null;
    let bestPos = Number.POSITIVE_INFINITY;
    for (const childId of children) {
      const childStatusId = resolveStatusId(childId);
      if (childStatusId == null) continue;
      const pos = statusPositionById.get(childStatusId) ?? Number.POSITIVE_INFINITY;
      if (pos < bestPos || (pos === bestPos && (bestId == null || childStatusId < bestId))) {
        bestPos = pos;
        bestId = childStatusId;
      }
    }
    statusMemo.set(id, bestId);
    return bestId;
  };

  for (const id of byId.keys()) {
    if (!childrenByParent.has(id)) continue;
    const issue = byId.get(id)!;
    const agg = resolveSchedule(id);
    issue.startDate = agg.start != null ? new Date(agg.start) : null;
    issue.endDate = agg.end != null ? new Date(agg.end) : null;
    const statusId = resolveStatusId(id);
    if (statusId != null) issue.statusId = statusId;
  }

  return Array.from(byId.values());
}

/** @deprecated applyAggregatedParentFields を使用 */
export function applyAggregatedParentSchedules<T extends AggregatableIssue>(
  issues: T[],
  statusPositionById: Map<number, number> = new Map()
): T[] {
  return applyAggregatedParentFields(issues, statusPositionById);
}

export async function wouldCreateIssueParentCycle(
  prisma: { issue: { findUnique: (args: any) => Promise<{ parentId: number | null } | null> } },
  issueId: number,
  parentId: number
): Promise<boolean> {
  if (issueId === parentId) return true;
  let current: number | null = parentId;
  const seen = new Set<number>();
  while (current != null) {
    if (current === issueId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    const row: { parentId: number | null } | null = await prisma.issue.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return false;
}

export async function validateIssueParentId(
  prisma: {
    issue: {
      findUnique: (args: any) => Promise<any>;
      count: (args: any) => Promise<number>;
    };
  },
  opts: {
    parentId: number | null | undefined;
    projectId: number;
    issueId?: number;
  }
): Promise<string | null> {
  if (opts.parentId == null) return null;
  const parentId = Number(opts.parentId);
  if (!Number.isInteger(parentId) || parentId <= 0) {
    return '親チケットが不正です';
  }
  if (opts.issueId != null && parentId === opts.issueId) {
    return '自分自身を親チケットに指定できません';
  }
  const parent = await prisma.issue.findUnique({
    where: { id: parentId },
    select: { id: true, projectId: true },
  });
  if (!parent) return '親チケットが見つかりません';
  if (parent.projectId !== opts.projectId) {
    return '親チケットは同一プロジェクト内である必要があります';
  }
  if (opts.issueId != null) {
    const cyclic = await wouldCreateIssueParentCycle(prisma, opts.issueId, parentId);
    if (cyclic) return '親チケットの指定により循環参照になります';
  }
  return null;
}

export async function issueHasChildren(
  prisma: { issue: { count: (args: any) => Promise<number> } },
  issueId: number
): Promise<boolean> {
  const count = await prisma.issue.count({ where: { parentId: issueId } });
  return count > 0;
}

/** 指定チケットとその全子孫の ID（同一プロジェクト内の親子木）を返す。先頭は rootId。 */
export async function collectIssueSubtreeIds(
  prisma: {
    issue: {
      findUnique: (args: any) => Promise<{ id: number; projectId: number } | null>;
      findMany: (args: any) => Promise<{ id: number; parentId: number | null }[]>;
    };
  },
  rootId: number
): Promise<number[]> {
  const root = await prisma.issue.findUnique({
    where: { id: rootId },
    select: { id: true, projectId: true },
  });
  if (!root) return [];

  const issues = await prisma.issue.findMany({
    where: { projectId: root.projectId },
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<number, number[]>();
  for (const issue of issues) {
    if (issue.parentId == null) continue;
    const list = childrenByParent.get(issue.parentId) ?? [];
    list.push(issue.id);
    childrenByParent.set(issue.parentId, list);
  }

  const result = [rootId];
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    result.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}
