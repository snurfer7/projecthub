import type { ComboboxOption } from '../components/Combobox';

export const UNGROUPED_OPTION_VALUE = '__ungrouped__';

export type GroupedUserOptionUser = {
  id: number;
  firstName: string;
  lastName: string;
};

export type GroupedUserOptionGroup = {
  id: number;
  name: string;
  members: { userId: number }[];
};

export type BuildGroupedUserOptionsParams = {
  users: GroupedUserOptionUser[];
  groups: GroupedUserOptionGroup[];
  /** ユーザー選択肢の value。省略時は `String(user.id)` */
  userValue?: (user: GroupedUserOptionUser) => string;
  /** グループ見出しの value。省略時は `g:{id}` */
  groupValue?: (group: GroupedUserOptionGroup) => string;
  /**
   * true: グループ見出しを選択可（`isGroupHeader`）。フィルタや担当グループ割当向け。
   * false: 見出しのみ（`isGroupLabel`）。ユーザー単一割当向け。
   */
  groupHeadersSelectable?: boolean;
};

/** ユーザーの所属グループ情報から、グルーピング用の groups 配列を組み立てる */
export function deriveGroupsFromUserMemberships(
  users: {
    id: number;
    groupMembers?: { group: { id: number; name: string } }[];
  }[],
): GroupedUserOptionGroup[] {
  const map = new Map<number, GroupedUserOptionGroup>();
  for (const u of users) {
    for (const gm of u.groupMembers ?? []) {
      let g = map.get(gm.group.id);
      if (!g) {
        g = { id: gm.group.id, name: gm.group.name, members: [] };
        map.set(gm.group.id, g);
      }
      g.members.push({ userId: u.id });
    }
  }
  return Array.from(map.values());
}

/**
 * 管理グループを見出しとし、所属ユーザーを直下に並べた Combobox 選択肢を返す。
 * いずれのグループにも属さないユーザーは「未所属」見出しの下に配置する。
 */
export function buildGroupedUserOptions({
  users,
  groups,
  userValue = (u) => String(u.id),
  groupValue = (g) => `g:${g.id}`,
  groupHeadersSelectable = true,
}: BuildGroupedUserOptionsParams): ComboboxOption[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  const options: ComboboxOption[] = [];
  const usersInAnyGroup = new Set<number>();

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  for (const g of sortedGroups) {
    options.push(
      groupHeadersSelectable
        ? { value: groupValue(g), label: g.name, isGroupHeader: true }
        : { value: groupValue(g), label: g.name, isGroupLabel: true },
    );
    const members = [...g.members]
      .map((m) => userById.get(m.userId))
      .filter((u): u is GroupedUserOptionUser => !!u)
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'ja'),
      );
    for (const u of members) {
      usersInAnyGroup.add(u.id);
      options.push({
        value: userValue(u),
        label: `${u.lastName} ${u.firstName}`,
      });
    }
  }

  const ungrouped = users
    .filter((u) => !usersInAnyGroup.has(u.id))
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'ja'),
    );
  if (ungrouped.length > 0) {
    options.push({
      value: UNGROUPED_OPTION_VALUE,
      label: '未所属',
      isGroupLabel: true,
    });
    for (const u of ungrouped) {
      options.push({
        value: userValue(u),
        label: `${u.lastName} ${u.firstName}`,
      });
    }
  }

  return options;
}

/** 担当者フィルタの onChange 値を user / group に分解する（memberIds はプロジェクトメンバー絞り込み等で利用） */
export function splitGroupedAssigneeSelection(
  values: (string | number)[],
  groups: GroupedUserOptionGroup[],
): {
  userIds: (string | number)[];
  groupIds: string[];
  memberIds: string[];
} {
  const groupIds = values.filter((v) => String(v).startsWith('g:')).map((v) => String(v).slice(2));
  const userIds = values.filter(
    (v) => !String(v).startsWith('g:') && String(v) !== UNGROUPED_OPTION_VALUE,
  );
  const memberIds = Array.from(
    new Set(
      groupIds.flatMap((gid) => {
        const g = groups.find((grp) => String(grp.id) === String(gid));
        return g ? g.members.map((m) => String(m.userId)) : [];
      }),
    ),
  );
  return { userIds, groupIds, memberIds };
}
