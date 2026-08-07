import { PrismaClient } from '@prisma/client';
import { getUserRoleIdsOnProject } from './projectMembership';

const prisma = new PrismaClient();

export type WorkflowTransitionPair = { oldStatusId: number; newStatusId: number };

export type IssueWorkflowInfo = {
  /** Statuses the user may set on create / as transition targets (OR across roles). */
  assignableStatusIds: number[];
  /**
   * Allowed old→new pairs (OR across roles).
   * `null` means no role has configured transitions → any change to an assignable status is allowed.
   */
  allowedTransitions: WorkflowTransitionPair[] | null;
};

type RoleWorkflowRow = {
  roleId: number;
  statusIds: number[];
  transitions: WorkflowTransitionPair[];
};

async function loadAllStatusIds(): Promise<number[]> {
  const rows = await prisma.issueStatus.findMany({
    select: { id: true },
    orderBy: { position: 'asc' },
  });
  return rows.map((r) => r.id);
}

async function loadUserRoleWorkflows(userId: number, projectId: number): Promise<RoleWorkflowRow[]> {
  const roleIds = await getUserRoleIdsOnProject(userId, projectId);
  if (roleIds.length === 0) return [];

  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: {
      id: true,
      statuses: { select: { statusId: true } },
      transitions: { select: { oldStatusId: true, newStatusId: true } },
    },
  });

  return roles.map((role) => ({
    roleId: role.id,
    statusIds: role.statuses.map((s) => s.statusId),
    transitions: role.transitions.map((t) => ({
      oldStatusId: t.oldStatusId,
      newStatusId: t.newStatusId,
    })),
  }));
}

/**
 * Resolve assignable statuses and allowed transitions for a user on a project.
 * Multi-role: OR union.
 * Backward compat: a role with empty RoleStatus contributes all statuses;
 * a role with empty WorkflowTransition contributes unrestricted transitions.
 * If the user has no roles, nothing is assignable / no transitions.
 */
export async function resolveIssueWorkflow(
  userId: number,
  projectId: number
): Promise<IssueWorkflowInfo> {
  const [allStatusIds, roleRows] = await Promise.all([
    loadAllStatusIds(),
    loadUserRoleWorkflows(userId, projectId),
  ]);

  if (roleRows.length === 0) {
    return { assignableStatusIds: [], allowedTransitions: [] };
  }

  const assignable = new Set<number>();
  let anyRoleUnrestrictedTransitions = false;
  const transitionKeys = new Set<string>();

  for (const role of roleRows) {
    if (role.statusIds.length === 0) {
      for (const id of allStatusIds) assignable.add(id);
    } else {
      for (const id of role.statusIds) assignable.add(id);
    }

    if (role.transitions.length === 0) {
      anyRoleUnrestrictedTransitions = true;
    } else {
      for (const t of role.transitions) {
        transitionKeys.add(`${t.oldStatusId}-${t.newStatusId}`);
      }
    }
  }

  const assignableStatusIds = allStatusIds.filter((id) => assignable.has(id));

  let allowedTransitions: WorkflowTransitionPair[] | null;
  if (anyRoleUnrestrictedTransitions) {
    allowedTransitions = null;
  } else {
    allowedTransitions = Array.from(transitionKeys).map((key) => {
      const [oldStatusId, newStatusId] = key.split('-').map(Number);
      return { oldStatusId, newStatusId };
    });
  }

  return { assignableStatusIds, allowedTransitions };
}

export function isStatusAssignable(workflow: IssueWorkflowInfo, statusId: number): boolean {
  return workflow.assignableStatusIds.includes(statusId);
}

export function isStatusTransitionAllowed(
  workflow: IssueWorkflowInfo,
  oldStatusId: number,
  newStatusId: number
): boolean {
  if (oldStatusId === newStatusId) return true;
  if (!isStatusAssignable(workflow, newStatusId)) return false;
  if (workflow.allowedTransitions === null) return true;
  return workflow.allowedTransitions.some(
    (t) => t.oldStatusId === oldStatusId && t.newStatusId === newStatusId
  );
}

/** @returns error message or null if OK */
export function assertAssignableStatus(
  workflow: IssueWorkflowInfo,
  statusId: number
): string | null {
  if (!Number.isFinite(statusId)) return 'ステータスが不正です';
  if (!isStatusAssignable(workflow, statusId)) {
    return 'このステータスを設定する権限がありません';
  }
  return null;
}

/** @returns error message or null if OK */
export function assertStatusTransition(
  workflow: IssueWorkflowInfo,
  oldStatusId: number,
  newStatusId: number
): string | null {
  if (oldStatusId === newStatusId) return null;
  if (!isStatusAssignable(workflow, newStatusId)) {
    return 'このステータスを設定する権限がありません';
  }
  if (!isStatusTransitionAllowed(workflow, oldStatusId, newStatusId)) {
    return 'このステータスへの遷移は許可されていません';
  }
  return null;
}
