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
  /** ルート同士の表示順（任意） */
  position?: number;
  parents?: { id: number; name?: string }[];
  /** 同一親内の子順（任意）。未指定時は name 順 */
  children?: { id: number; name?: string }[];
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
 * 所属から得た groups に、階層付きグループ一覧の parents/children/position を合成する。
 * hierarchySource に無いグループはフラットのまま。
 */
export function mergeGroupHierarchy(
  groups: GroupedUserOptionGroup[],
  hierarchySource: GroupedUserOptionGroup[],
): GroupedUserOptionGroup[] {
  const byId = new Map(hierarchySource.map((g) => [g.id, g]));
  const idSet = new Set(groups.map((g) => g.id));
  return groups.map((g) => {
    const src = byId.get(g.id);
    if (!src) return g;
    return {
      ...g,
      position: src.position,
      parents: (src.parents ?? []).filter((p) => idSet.has(p.id)),
      children: (src.children ?? []).filter((c) => idSet.has(c.id)),
    };
  });
}

function sortUsers(a: GroupedUserOptionUser, b: GroupedUserOptionUser) {
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'ja');
}

function sortGroups(a: GroupedUserOptionGroup, b: GroupedUserOptionGroup) {
  const pos = (a.position ?? 0) - (b.position ?? 0);
  if (pos !== 0) return pos;
  return a.name.localeCompare(b.name, 'ja');
}

function pushGroupHeader(
  options: ComboboxOption[],
  g: GroupedUserOptionGroup,
  depth: number,
  groupValue: (group: GroupedUserOptionGroup) => string,
  groupHeadersSelectable: boolean,
) {
  options.push(
    groupHeadersSelectable
      ? { value: groupValue(g), label: g.name, isGroupHeader: true, depth }
      : { value: groupValue(g), label: g.name, isGroupLabel: true, depth },
  );
}

function pushGroupMembers(
  options: ComboboxOption[],
  g: GroupedUserOptionGroup,
  depth: number,
  userById: Map<number, GroupedUserOptionUser>,
  userValue: (user: GroupedUserOptionUser) => string,
  usersInAnyGroup: Set<number>,
) {
  const members = [...g.members]
    .map((m) => userById.get(m.userId))
    .filter((u): u is GroupedUserOptionUser => !!u)
    .sort(sortUsers);
  for (const u of members) {
    usersInAnyGroup.add(u.id);
    options.push({
      value: userValue(u),
      label: `${u.lastName} ${u.firstName}`,
      depth,
    });
  }
}

/**
 * 管理グループを見出しとし、所属ユーザーを直下に並べた Combobox 選択肢を返す。
 * parents/children がある場合はグループ階層ツリーで表示する（多親は各親の下に現れる）。
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
  const byId = new Map(groups.map((g) => [g.id, g]));
  const hasHierarchy = groups.some(
    (g) => (g.children?.length ?? 0) > 0 || (g.parents?.length ?? 0) > 0,
  );

  if (!hasHierarchy) {
    const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    for (const g of sortedGroups) {
      pushGroupHeader(options, g, 0, groupValue, groupHeadersSelectable);
      pushGroupMembers(options, g, 1, userById, userValue, usersInAnyGroup);
    }
  } else {
    const childrenOf = (group: GroupedUserOptionGroup, ancestors: Set<number>) => {
      const fromExplicit = !!(group.children && group.children.length > 0);
      const childIds = fromExplicit
        ? group.children!.map((c) => c.id)
        : groups.filter((g) => g.parents?.some((p) => p.id === group.id)).map((g) => g.id);
      const list = childIds
        .map((id) => byId.get(id))
        .filter((c): c is GroupedUserOptionGroup => !!c && !ancestors.has(c.id));
      return fromExplicit ? list : list.sort(sortGroups);
    };

    const reachable = new Set<number>();
    const markReachable = (group: GroupedUserOptionGroup, seen: Set<number>) => {
      if (seen.has(group.id)) return;
      seen.add(group.id);
      reachable.add(group.id);
      for (const child of childrenOf(group, new Set())) {
        markReachable(child, seen);
      }
    };

    const parentless = [...groups]
      .filter((g) => !g.parents || g.parents.length === 0)
      .sort(sortGroups);
    for (const root of parentless) markReachable(root, new Set());

    const orphans = groups.filter((g) => !reachable.has(g.id)).sort(sortGroups);
    const roots = [...parentless, ...orphans];

    const visit = (group: GroupedUserOptionGroup, depth: number, ancestors: Set<number>) => {
      pushGroupHeader(options, group, depth, groupValue, groupHeadersSelectable);
      pushGroupMembers(options, group, depth + 1, userById, userValue, usersInAnyGroup);
      const nextAncestors = new Set(ancestors).add(group.id);
      for (const child of childrenOf(group, ancestors)) {
        visit(child, depth + 1, nextAncestors);
      }
    };
    for (const root of roots) visit(root, 0, new Set());
  }

  const ungrouped = users.filter((u) => !usersInAnyGroup.has(u.id)).sort(sortUsers);
  if (ungrouped.length > 0) {
    options.push({
      value: UNGROUPED_OPTION_VALUE,
      label: '未所属',
      isGroupLabel: true,
      depth: 0,
    });
    for (const u of ungrouped) {
      options.push({
        value: userValue(u),
        label: `${u.lastName} ${u.firstName}`,
        depth: 1,
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
