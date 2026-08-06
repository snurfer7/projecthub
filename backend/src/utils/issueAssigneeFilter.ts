import { parseNumericQueryIds } from './queryParams';

/**
 * Prisma where に担当ユーザー／担当グループ条件を付与する。
 * 両方指定時は OR（ユーザー担当に一致、または担当グループに一致）。
 * 単数 Query（assignedToId / assignedToGroupId）も後方互換で受理する。
 */
export function applyAssigneeOrFilter(
  where: Record<string, unknown>,
  query: {
    assignedToId?: unknown;
    assignedToIds?: unknown;
    assignedToGroupId?: unknown;
    assignedToGroupIds?: unknown;
  },
): void {
  const assigneeIds = parseNumericQueryIds(query.assignedToIds ?? query.assignedToId);
  const groupIds = parseNumericQueryIds(query.assignedToGroupIds ?? query.assignedToGroupId);

  if (assigneeIds.length === 0 && groupIds.length === 0) return;

  const branches: Record<string, unknown>[] = [];
  if (assigneeIds.length > 0) {
    branches.push({ assignees: { some: { userId: { in: assigneeIds } } } });
  }
  if (groupIds.length > 0) {
    branches.push({ assignedToGroupId: { in: groupIds } });
  }

  if (branches.length === 1) {
    Object.assign(where, branches[0]);
  } else {
    where.OR = branches;
  }
}
