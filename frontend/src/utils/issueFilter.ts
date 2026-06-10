import { Issue } from '../types';

export type IssueFilterCriteria = {
  trackerId: number | '';
  statusId: number | '';
  assignedToIds: (number | string)[];
  dueDateStart: string;
  dueDateEnd: string;
};

export function defaultIssueFilterCriteria(): IssueFilterCriteria {
  return {
    trackerId: '',
    statusId: '',
    assignedToIds: [],
    dueDateStart: '',
    dueDateEnd: '',
  };
}

export function matchesIssueFilter(issue: Issue, criteria: IssueFilterCriteria): boolean {
  if (criteria.trackerId && issue.trackerId !== criteria.trackerId) return false;
  if (criteria.statusId && issue.statusId !== criteria.statusId) return false;
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
