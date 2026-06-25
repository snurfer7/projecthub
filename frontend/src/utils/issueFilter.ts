import { Issue } from '../types';

export type IssueFilterCriteria = {
  trackerIds: (number | string)[];
  statusIds: (number | string)[];
  assignedToIds: (number | string)[];
  assignedToGroupIds: (number | string)[];
  /** 選択されたグループのメンバー userId を展開したもの（担当者フィルターの OR 拡張用） */
  assignedToGroupMemberIds: (number | string)[];
  dueDateStart: string;
  dueDateEnd: string;
};

export function defaultIssueFilterCriteria(): IssueFilterCriteria {
  return {
    trackerIds: [],
    statusIds: [],
    assignedToIds: [],
    assignedToGroupIds: [],
    assignedToGroupMemberIds: [],
    dueDateStart: '',
    dueDateEnd: '',
  };
}

function matchesIdList(value: number | undefined | null, ids: (number | string)[]): boolean {
  if (ids.length === 0) return true;
  if (value == null) return false;
  return ids.some((id) => String(id) === String(value));
}

export function matchesIssueFilter(issue: Issue, criteria: IssueFilterCriteria): boolean {
  if (!matchesIdList(issue.trackerId, criteria.trackerIds)) return false;
  if (!matchesIdList(issue.statusId, criteria.statusIds)) return false;
  const hasUserFilter = criteria.assignedToIds.length > 0;
  const hasGroupFilter = criteria.assignedToGroupIds.length > 0;
  const hasGroupMemberFilter = criteria.assignedToGroupMemberIds.length > 0;
  if (hasUserFilter || hasGroupFilter || hasGroupMemberFilter) {
    // 直接指定ユーザーに一致
    const userMatch =
      hasUserFilter &&
      issue.assignedToId != null &&
      criteria.assignedToIds.some((id) => String(id) === String(issue.assignedToId));
    // 選択グループのメンバーに担当ユーザーが含まれる
    const groupMemberMatch =
      hasGroupMemberFilter &&
      issue.assignedToId != null &&
      criteria.assignedToGroupMemberIds.some((id) => String(id) === String(issue.assignedToId));
    // チケットが選択グループに直接割り当てられている
    const groupMatch =
      hasGroupFilter &&
      issue.assignedToGroupId != null &&
      criteria.assignedToGroupIds.some((id) => String(id) === String(issue.assignedToGroupId));
    if (!userMatch && !groupMemberMatch && !groupMatch) return false;
  }

  const { dueDateStart, dueDateEnd } = criteria;
  if (dueDateStart || dueDateEnd) {
    if (!issue.dueDate) return false;
    const due = issue.dueDate.slice(0, 10);
    if (dueDateStart && due < dueDateStart) return false;
    if (dueDateEnd && due > dueDateEnd) return false;
  }

  return true;
}

export function filterIssues(issues: Issue[], criteria: IssueFilterCriteria): Issue[] {
  return issues.filter((issue) => matchesIssueFilter(issue, criteria));
}

export function filterIssuesByProjectIds(issues: Issue[], projectIds: Set<number>): Issue[] {
  return issues.filter((issue) => projectIds.has(issue.projectId));
}
