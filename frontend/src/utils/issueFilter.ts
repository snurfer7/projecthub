import { Issue } from '../types';

export type IssueFilterCriteria = {
  trackerIds: (number | string)[];
  statusIds: (number | string)[];
  assignedToIds: (number | string)[];
  dueDateStart: string;
  dueDateEnd: string;
};

export function defaultIssueFilterCriteria(): IssueFilterCriteria {
  return {
    trackerIds: [],
    statusIds: [],
    assignedToIds: [],
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
  if (criteria.assignedToIds.length > 0) {
    const assigneeId = issue.assignedToId;
    if (
      assigneeId == null ||
      !criteria.assignedToIds.some((id) => String(id) === String(assigneeId))
    ) {
      return false;
    }
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
