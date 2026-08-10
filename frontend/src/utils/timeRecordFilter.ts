import { UNGROUPED_OPTION_VALUE } from './groupedUserOptions';

/** 記録者フィルタの選択値を API 用の userIds / userGroupIds に分割する */
export function splitTimeRecordFilterSelection(selection: (number | string)[]): {
  userIds: string[];
  userGroupIds: string[];
} {
  const userGroupIds = selection
    .filter((v) => String(v).startsWith('g:'))
    .map((v) => String(v).slice(2));
  const userIds = selection
    .filter((v) => !String(v).startsWith('g:') && String(v) !== UNGROUPED_OPTION_VALUE)
    .map((v) => String(v));
  return { userIds, userGroupIds };
}

/** 記録者フィルタの選択値（ユーザー ID / `g:{groupId}`）を API 用ユーザー ID に展開する */
export function resolveTimeRecordFilterUserIds(
  selection: (number | string)[],
  groups: { id: number; members: { userId: number }[] }[],
): string[] {
  const { userIds, userGroupIds } = splitTimeRecordFilterSelection(selection);
  const memberIds = userGroupIds.flatMap((gid) => {
    const g = groups.find((grp) => String(grp.id) === String(gid));
    return g ? g.members.map((m) => String(m.userId)) : [];
  });
  return Array.from(new Set([...userIds, ...memberIds]));
}
