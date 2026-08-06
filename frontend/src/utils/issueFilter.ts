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
  /**
   * 後方互換用（保存済み検索など）。グループ選択時はメンバー展開しないため常に空。
   * マッチングには使わない。
   */
  assignedToGroupMemberIds: (number | string)[];
  /** true のとき担当ユーザー・担当グループ未設定のチケットを担当者条件の OR 対象に含める */
  includeUnassigned: boolean;
  dueDateStart: string;
  dueDateEnd: string;
  dueDateMode: DateRangeSpecifyMode;
  dueDateRelative: DateRangeRelativePreset | '';
  /** チケット開始日〜終了日との重なり判定用（フィルタ期間の開始。ガント／カンバン／時間） */
  scheduleDateStart: string;
  /** チケット開始日〜終了日との重なり判定用（フィルタ期間の終了） */
  scheduleDateEnd: string;
  scheduleDateMode: DateRangeSpecifyMode;
  scheduleDateRelative: DateRangeRelativePreset | '';
  /**
   * true のとき開始・終了期間指定ありでも、開始・終了とも未設定のチケットを
   * 期間重なりと OR で含める（省略時・false は従来どおり除外）
   */
  includeUnscheduled: boolean;
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
    includeUnscheduled: false,
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

/** 開始日・終了日がともに未設定（親は API 集約後の値で判定） */
export function isIssueUnscheduled(
  issue: Pick<Issue, 'startDate' | 'endDate'> | { startDate?: string | null; endDate?: string | null },
): boolean {
  return !toDateOnly(issue.startDate) && !toDateOnly(issue.endDate);
}

/**
 * チケットの開始日〜終了日と、指定期間が一部でも重なるか。
 * - フィルタ片側のみ: 他端は無限として扱う
 * - チケット片側のみ: その日を点（開始＝終了）として扱う
 * - チケット両方未設定: 重ならない（`includeUnscheduled` は呼び出し側で OR）
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
  const includeUnassigned = criteria.includeUnassigned === true;
  if (hasUserFilter || hasGroupFilter || includeUnassigned) {
    const userMatch =
      hasUserFilter &&
      issueHasAssigneeUser(issue, criteria.assignedToIds);
    // グループ選択は担当グループ一致のみ（所属メンバーのユーザー担当は含めない）
    const groupMatch =
      hasGroupFilter &&
      issue.assignedToGroupId != null &&
      criteria.assignedToGroupIds.some((id) => String(id) === String(issue.assignedToGroupId));
    const unassignedMatch = includeUnassigned && isIssueUnassigned(issue);
    if (!userMatch && !groupMatch && !unassignedMatch) return false;
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
  const overlaps = overlapsScheduleRange(
    issue.startDate,
    issue.endDate,
    scheduleRange.start,
    scheduleRange.end,
  );
  if (!overlaps) {
    const includeUnscheduled = criteria.includeUnscheduled === true;
    if (!(includeUnscheduled && isIssueUnscheduled(issue))) return false;
  }

  return true;
}

export function filterIssues(issues: Issue[], criteria: IssueFilterCriteria): Issue[] {
  return issues.filter((issue) => matchesIssueFilter(issue, criteria));
}

export function filterIssuesByProjectIds(issues: Issue[], projectIds: Set<number>): Issue[] {
  return issues.filter((issue) => projectIds.has(issue.projectId));
}
