/** グループ親子 DAG の循環検出・検証 */

export type GroupHierarchyEdge = { parentGroupId: number; childGroupId: number };

/** 有向グラフ（parent → child）にサイクルがあるか */
export function hasCycleInGroupHierarchy(edges: GroupHierarchyEdge[]): boolean {
  const childrenByParent = new Map<number, number[]>();
  const nodes = new Set<number>();
  for (const { parentGroupId, childGroupId } of edges) {
    if (parentGroupId === childGroupId) return true;
    nodes.add(parentGroupId);
    nodes.add(childGroupId);
    const list = childrenByParent.get(parentGroupId) ?? [];
    list.push(childGroupId);
    childrenByParent.set(parentGroupId, list);
  }

  // 0 = unvisited, 1 = visiting, 2 = done
  const state = new Map<number, 0 | 1 | 2>();
  for (const id of nodes) state.set(id, 0);

  function dfs(id: number): boolean {
    const s = state.get(id) ?? 0;
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(id, 1);
    for (const child of childrenByParent.get(id) ?? []) {
      if (dfs(child)) return true;
    }
    state.set(id, 2);
    return false;
  }

  for (const id of nodes) {
    if ((state.get(id) ?? 0) === 0 && dfs(id)) return true;
  }
  return false;
}

/**
 * グループ G の親・子リンクを差し替えたあとのエッジ集合を構築する。
 * parentIds / childIds が undefined の側は既存エッジを維持する。
 */
export function buildEdgesAfterGroupUpdate(
  existing: GroupHierarchyEdge[],
  groupId: number,
  parentIds: number[] | undefined,
  childIds: number[] | undefined
): GroupHierarchyEdge[] {
  let edges = existing.filter((e) => {
    if (parentIds !== undefined && e.childGroupId === groupId) return false;
    if (childIds !== undefined && e.parentGroupId === groupId) return false;
    return true;
  });

  if (parentIds !== undefined) {
    for (const parentGroupId of parentIds) {
      edges.push({ parentGroupId, childGroupId: groupId });
    }
  }
  if (childIds !== undefined) {
    for (const childGroupId of childIds) {
      edges.push({ parentGroupId: groupId, childGroupId });
    }
  }

  // 重複除去
  const seen = new Set<string>();
  edges = edges.filter((e) => {
    const key = `${e.parentGroupId}:${e.childGroupId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return edges;
}

export function normalizeIdList(raw: unknown): number[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const ids = [
    ...new Set(
      raw
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
  return ids;
}

function buildChildrenByParent(edges: GroupHierarchyEdge[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const { parentGroupId, childGroupId } of edges) {
    const list = map.get(parentGroupId) ?? [];
    list.push(childGroupId);
    map.set(parentGroupId, list);
  }
  return map;
}

function buildParentsByChild(edges: GroupHierarchyEdge[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const { parentGroupId, childGroupId } of edges) {
    const list = map.get(childGroupId) ?? [];
    list.push(parentGroupId);
    map.set(childGroupId, list);
  }
  return map;
}

/** Descendants of rootId (does not include rootId). */
export function getDescendantGroupIds(edges: GroupHierarchyEdge[], rootId: number): number[] {
  const childrenByParent = buildChildrenByParent(edges);
  const out: number[] = [];
  const seen = new Set<number>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child);
  }
  return out;
}

/** Ancestors of groupId (does not include groupId). */
export function getAncestorGroupIds(edges: GroupHierarchyEdge[], groupId: number): number[] {
  const parentsByChild = buildParentsByChild(edges);
  const out: number[] = [];
  const seen = new Set<number>();
  const stack = [...(parentsByChild.get(groupId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const parent of parentsByChild.get(id) ?? []) stack.push(parent);
  }
  return out;
}

/** rootId plus all descendants. */
export function getGroupSubtreeIds(edges: GroupHierarchyEdge[], rootId: number): number[] {
  return [rootId, ...getDescendantGroupIds(edges, rootId)];
}
