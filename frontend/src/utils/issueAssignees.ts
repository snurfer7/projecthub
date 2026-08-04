import { Issue } from '../types';

/** 担当ユーザー一覧（assignees 優先、なければ旧 assignedTo） */
export function issueAssigneeUsers(
  issue: Pick<Issue, 'assignees' | 'assignedTo'>,
): { id: number; firstName: string; lastName: string }[] {
  if (issue.assignees && issue.assignees.length > 0) return issue.assignees;
  if (issue.assignedTo) return [issue.assignedTo];
  return [];
}

export function formatIssueAssignees(
  issue: Pick<Issue, 'assignees' | 'assignedTo' | 'assignedToGroup'>,
): string {
  const parts: string[] = [];
  if (issue.assignedToGroup) {
    parts.push(issue.assignedToGroup.name);
  }
  for (const u of issueAssigneeUsers(issue)) {
    parts.push(`${u.lastName} ${u.firstName}`);
  }
  return parts.join(', ');
}

export function issueHasAssigneeUser(
  issue: Pick<Issue, 'assignees' | 'assignedTo' | 'assignedToId'>,
  userIds: (number | string)[],
): boolean {
  if (userIds.length === 0) return false;
  const assignees = issueAssigneeUsers(issue);
  if (assignees.length > 0) {
    return assignees.some((u) => userIds.some((id) => String(id) === String(u.id)));
  }
  if (issue.assignedToId != null) {
    return userIds.some((id) => String(id) === String(issue.assignedToId));
  }
  return false;
}

/** 担当ユーザー・担当グループのいずれも未設定 */
export function isIssueUnassigned(
  issue: Pick<Issue, 'assignees' | 'assignedTo' | 'assignedToId' | 'assignedToGroupId' | 'assignedToGroup'>,
): boolean {
  if (issue.assignedToGroupId != null || issue.assignedToGroup) return false;
  return issueAssigneeUsers(issue).length === 0 && issue.assignedToId == null;
}
