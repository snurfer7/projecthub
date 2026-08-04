import { Issue } from '../types';
import {
  effectiveDateRange,
  type DateRangeRelativePreset,
  type DateRangeSpecifyMode,
} from './dateRangeSpecify';
import { issueHasAssigneeUser, isIssueUnassigned } from './issueAssignees';

/** 担当者フィルタの「未割当」選択肢 value */
export const UNASSIGNED_ASSIGNEE_VALUE = '__unassigned__';

export type IssueFilterCriteria = {
  trackerIds: (number | string)[];
  statusIds: (number | string)[];
  assignedToIds: (number | string)[];
  assignedToGroupIds: (number | string)[];
  /** 選択されたグループのメンバー userId を展開したもの（担当者フィルターの OR 拡張用） */
  assignedToGroupMemberIds: (number | string)[];
  /** true のとき担当ユーザー・担当グループ未設定のチケットを担当者条件の OR 対象に含める */
  includeUnassigned: boolean;
  dueDateStart: string;
  dueDateEnd: string;
  dueDateMode: DateRangeSpecifyMode;
  dueDateRelative: DateRangeRelativePreset | '';
  /** チケット開始日〜終了日との重なり判定用（フィルタ期間の開始） */
  scheduleDateStart: string;
  /** チケット開始日〜終了日との重なり判定用（フィルタ期間の終了） */
  scheduleDateEnd: string;
  scheduleDateMode: DateRangeSpecifyMode;
  scheduleDateRelative: DateRangeRelativePreset | '';
};

export function defaultIssueFilterCriteria(): IssueFilterCriteria {
  return {
    trackerIds: [],
    statusIds: [],
    assignedToIds: [],
    assignedToGroupIds: [],
    assignedToGroupMemberIds: [],
    includeUnassigned: false,
    dueDateStart: '',
    dueDateEnd: '',
    dueDateMode: 'direct',
    dueDateRelative: '',
    scheduleDateStart: '',
    scheduleDateEnd: '',
    scheduleDateMode: 'direct',
    scheduleDateRelative: '',
  };
}

function matchesIdList(value: number | undefined | null, ids: (number | string)[]): boolean {
  if (ids.length === 0) return true;
  if (value == null) return false;
  return ids.some((id) => String(id) === String(value));
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/**
 * チケットの開始日〜終了日と、指定期間が一部でも重なるか。
 * - フィルタ片側のみ: 他端は無限として扱う
 * - チケット片側のみ: その日を点（開始＝終了）として扱う
 * - チケット両方未設定: 重ならない
 */
export function overlapsScheduleRange(
  issueStart: string | null | undefined,
  issueEnd: string | null | undefined,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (!rangeStart && !rangeEnd) return true;

  const start = toDateOnly(issueStart);
  const end = toDateOnly(issueEnd);
  if (!start && !end) return false;

  const issueFrom = start ?? end!;
  const issueTo = end ?? start!;

  if (rangeEnd && issueFrom > rangeEnd) return false;
  if (rangeStart && issueTo < rangeStart) return false;
  return true;
}

export function matchesIssueFilter(issue: Issue, criteria: IssueFilterCriteria): boolean {
  if (!matchesIdList(issue.trackerId, criteria.trackerIds)) return false;
  if (!matchesIdList(issue.statusId, criteria.statusIds)) return false;
  const hasUserFilter = criteria.assignedToIds.length > 0;
  const hasGroupFilter = criteria.assignedToGroupIds.length > 0;
  const hasGroupMemberFilter = criteria.assignedToGroupMemberIds.length > 0;
  const includeUnassigned = criteria.includeUnassigned === true;
  if (hasUserFilter || hasGroupFilter || hasGroupMemberFilter || includeUnassigned) {
    const userMatch =
      hasUserFilter &&
      issueHasAssigneeUser(issue, criteria.assignedToIds);
    const groupMemberMatch =
      hasGroupMemberFilter &&
      issueHasAssigneeUser(issue, criteria.assignedToGroupMemberIds);
    const groupMatch =
      hasGroupFilter &&
      issue.assignedToGroupId != null &&
      criteria.assignedToGroupIds.some((id) => String(id) === String(issue.assignedToGroupId));
    const unassignedMatch = includeUnassigned && isIssueUnassigned(issue);
    if (!userMatch && !groupMemberMatch && !groupMatch && !unassignedMatch) return false;
  }

  const dueRange = effectiveDateRange(
    criteria.dueDateMode,
    criteria.dueDateRelative,
    criteria.dueDateStart,
    criteria.dueDateEnd,
  );
  if (dueRange.start || dueRange.end) {
    if (!issue.dueDate) return false;
    const due = issue.dueDate.slice(0, 10);
    if (dueRange.start && due < dueRange.start) return false;
    if (dueRange.end && due > dueRange.end) return false;
  }

  const scheduleRange = effectiveDateRange(
    criteria.scheduleDateMode,
    criteria.scheduleDateRelative,
    criteria.scheduleDateStart,
    criteria.scheduleDateEnd,
  );
  if (!overlapsScheduleRange(issue.startDate, issue.endDate, scheduleRange.start, scheduleRange.end)) {
    return false;
  }

  return true;
}

export function filterIssues(issues: Issue[], criteria: IssueFilterCriteria): Issue[] {
  return issues.filter((issue) => matchesIssueFilter(issue, criteria));
}

export function filterIssuesByProjectIds(issues: Issue[], projectIds: Set<number>): Issue[] {
  return issues.filter((issue) => projectIds.has(issue.projectId));
}
