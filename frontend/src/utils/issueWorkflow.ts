import type { IssueMetaWorkflow, IssueStatus } from '../types';

/** Status options for create (assignable only) or edit (current + allowed targets). */
export function getSelectableStatuses(
  statuses: IssueStatus[],
  workflow: IssueMetaWorkflow | undefined | null,
  options: { mode: 'create' | 'edit'; currentStatusId?: number | null }
): IssueStatus[] {
  if (!workflow) return statuses;

  const assignable = new Set(workflow.assignableStatusIds);
  const currentId = options.currentStatusId != null ? Number(options.currentStatusId) : null;

  if (options.mode === 'create') {
    return statuses.filter((s) => assignable.has(s.id));
  }

  const allowed = new Set<number>();
  if (currentId != null) allowed.add(currentId);

  if (workflow.allowedTransitions === null) {
    for (const id of workflow.assignableStatusIds) allowed.add(id);
  } else if (currentId != null) {
    for (const t of workflow.allowedTransitions) {
      if (t.oldStatusId === currentId && assignable.has(t.newStatusId)) {
        allowed.add(t.newStatusId);
      }
    }
  }

  return statuses.filter((s) => allowed.has(s.id));
}

export function isStatusAssignable(
  workflow: IssueMetaWorkflow | undefined | null,
  statusId: number
): boolean {
  if (!workflow) return true;
  return workflow.assignableStatusIds.includes(statusId);
}

export function isStatusTransitionAllowed(
  workflow: IssueMetaWorkflow | undefined | null,
  oldStatusId: number,
  newStatusId: number
): boolean {
  if (oldStatusId === newStatusId) return true;
  if (!workflow) return true;
  if (!workflow.assignableStatusIds.includes(newStatusId)) return false;
  if (workflow.allowedTransitions === null) return true;
  return workflow.allowedTransitions.some(
    (t) => t.oldStatusId === oldStatusId && t.newStatusId === newStatusId
  );
}
