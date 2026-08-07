import { PrismaClient } from '@prisma/client';
import { codesForFieldInputCheck } from '../constants/fieldPermissionAliases';

export type PermissionEntry = { canUse: boolean; canInput: boolean };
export type PermissionMap = Record<string, PermissionEntry>;

const prisma = new PrismaClient();

let resourceTreeCache: Array<{
  id: number;
  code: string;
  parentId: number | null;
  scope: string;
}> | null = null;

async function getResourceTree() {
  const count = await prisma.permissionResource.count();
  if (resourceTreeCache === null || resourceTreeCache.length !== count) {
    resourceTreeCache = await prisma.permissionResource.findMany({
      select: { id: true, code: true, parentId: true, scope: true },
    });
  }
  return resourceTreeCache;
}

export function clearPermissionCache() {
  resourceTreeCache = null;
}

export function applyInheritance(
  merged: Map<string, PermissionEntry>,
  resources: Array<{ id: number; code: string; parentId: number | null }>
): PermissionMap {
  const childrenByParent = new Map<number | null, typeof resources>();
  for (const r of resources) {
    const list = childrenByParent.get(r.parentId) ?? [];
    list.push(r);
    childrenByParent.set(r.parentId, list);
  }

  const result = new Map<string, PermissionEntry>();

  function walk(parentCanUse: boolean, node: (typeof resources)[0]) {
    const entry = merged.get(node.code) ?? { canUse: false, canInput: false };
    const canUse = parentCanUse && entry.canUse;
    const canInput = canUse && entry.canInput;
    result.set(node.code, { canUse, canInput });
    for (const child of childrenByParent.get(node.id) ?? []) {
      walk(canUse, child);
    }
  }

  for (const root of childrenByParent.get(null) ?? []) {
    walk(true, root);
  }

  const out: PermissionMap = {};
  for (const [code, entry] of result) {
    out[code] = entry;
  }
  return out;
}

/**
 * Inheritance for a subtree where some parents may be outside the scope.
 * Nodes whose parent is not in `resources` are treated as roots (parentCanUse=true).
 */
export function applyInheritanceScoped(
  merged: Map<string, PermissionEntry>,
  resources: Array<{ id: number; code: string; parentId: number | null }>
): PermissionMap {
  const idSet = new Set(resources.map((r) => r.id));
  const childrenByParent = new Map<number | null, typeof resources>();
  for (const r of resources) {
    const parentKey = r.parentId != null && idSet.has(r.parentId) ? r.parentId : null;
    const list = childrenByParent.get(parentKey) ?? [];
    list.push(r);
    childrenByParent.set(parentKey, list);
  }

  const result = new Map<string, PermissionEntry>();

  function walk(parentCanUse: boolean, node: (typeof resources)[0]) {
    const entry = merged.get(node.code) ?? { canUse: false, canInput: false };
    const canUse = parentCanUse && entry.canUse;
    const canInput = canUse && entry.canInput;
    result.set(node.code, { canUse, canInput });
    for (const child of childrenByParent.get(node.id) ?? []) {
      walk(canUse, child);
    }
  }

  for (const root of childrenByParent.get(null) ?? []) {
    walk(true, root);
  }

  const out: PermissionMap = {};
  for (const [code, entry] of result) {
    out[code] = entry;
  }
  return out;
}

export async function resolveUserPermissions(userId: number): Promise<PermissionMap> {
  const [groupMembers, allGroups, hierarchyEdges] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    }),
    prisma.group.findMany({
      include: {
        permissionSet: {
          include: {
            permissions: {
              include: { resource: { select: { code: true, scope: true } } },
            },
          },
        },
      },
    }),
    prisma.groupHierarchy.findMany({
      select: { parentGroupId: true, childGroupId: true },
    }),
  ]);

  const parentsByChild = new Map<number, number[]>();
  for (const e of hierarchyEdges) {
    const list = parentsByChild.get(e.childGroupId) ?? [];
    list.push(e.parentGroupId);
    parentsByChild.set(e.childGroupId, list);
  }

  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  const memo = new Map<number, Map<string, PermissionEntry>>();
  const resolving = new Set<number>();

  function mergeInto(
    target: Map<string, PermissionEntry>,
    code: string,
    canUse: boolean,
    canInput: boolean
  ) {
    const existing = target.get(code) ?? { canUse: false, canInput: false };
    target.set(code, {
      canUse: existing.canUse || canUse,
      canInput: existing.canInput || canInput,
    });
  }

  function applyPermissionSet(
    target: Map<string, PermissionEntry>,
    set: NonNullable<(typeof allGroups)[0]['permissionSet']>
  ) {
    for (const p of set.permissions) {
      if (p.resource.scope === 'role') continue;
      mergeInto(target, p.resource.code, p.canUse, p.canInput);
    }
  }

  function resolveGroupEffective(groupId: number): Map<string, PermissionEntry> {
    const cached = memo.get(groupId);
    if (cached) return cached;
    if (resolving.has(groupId)) return new Map();
    resolving.add(groupId);

    const result = new Map<string, PermissionEntry>();
    const group = groupById.get(groupId);
    if (group?.permissionSet) {
      applyPermissionSet(result, group.permissionSet);
    } else {
      for (const parentId of parentsByChild.get(groupId) ?? []) {
        const parentPerms = resolveGroupEffective(parentId);
        for (const [code, entry] of parentPerms) {
          mergeInto(result, code, entry.canUse, entry.canInput);
        }
      }
    }

    resolving.delete(groupId);
    memo.set(groupId, result);
    return result;
  }

  const merged = new Map<string, PermissionEntry>();
  for (const gm of groupMembers) {
    const effective = resolveGroupEffective(gm.groupId);
    for (const [code, entry] of effective) {
      mergeInto(merged, code, entry.canUse, entry.canInput);
    }
  }

  const allResources = await getResourceTree();
  const groupResources = allResources.filter((r) => r.scope !== 'role');
  boostParentPermissionsFromChildren(merged, groupResources);
  const inherited = applyInheritanceScoped(merged, groupResources);
  return expandLegacyFieldAliases(inherited);
}

/** DB に旧 startDate / endDate のみある場合も新フィールドコードで効くようにする */
export function expandLegacyFieldAliases(map: PermissionMap): PermissionMap {
  const out: PermissionMap = { ...map };

  const applyLegacy = (
    legacyCode: string,
    targets: string[]
  ) => {
    const legacy = out[legacyCode];
    if (!legacy?.canInput && !legacy?.canUse) return;
    for (const code of targets) {
      const cur = out[code] ?? { canUse: false, canInput: false };
      out[code] = {
        canUse: cur.canUse || legacy.canUse,
        canInput: cur.canInput || legacy.canInput,
      };
    }
  };

  applyLegacy('projects.issues.fields.startDate', ['projects.issues.fields.startDateTime']);
  applyLegacy('projects.issues.fields.endDate', ['projects.issues.fields.endDateTime']);
  applyLegacy('projects.issues.fields.startDateTime.date', ['projects.issues.fields.startDateTime']);
  applyLegacy('projects.issues.fields.startDateTime.time', ['projects.issues.fields.startDateTime']);
  applyLegacy('projects.issues.fields.endDateTime.date', ['projects.issues.fields.endDateTime']);
  applyLegacy('projects.issues.fields.endDateTime.time', ['projects.issues.fields.endDateTime']);

  return out;
}

export function boostParentPermissionsFromChildren(
  merged: Map<string, PermissionEntry>,
  resources: Array<{ id: number; code: string; parentId: number | null }>
) {
  const childrenByParent = new Map<number | null, typeof resources>();
  for (const r of resources) {
    const list = childrenByParent.get(r.parentId) ?? [];
    list.push(r);
    childrenByParent.set(r.parentId, list);
  }

  function descendantsMatch(id: number, pred: (e: PermissionEntry) => boolean): boolean {
    for (const child of childrenByParent.get(id) ?? []) {
      const entry = merged.get(child.code);
      if (entry && pred(entry)) return true;
      if (descendantsMatch(child.id, pred)) return true;
    }
    return false;
  }

  // Boost canUse only. Feature-level canInput (create/update/delete) must stay
  // explicit — otherwise field canInput would re-enable parent input.
  for (const r of resources) {
    if (!(childrenByParent.get(r.id)?.length)) continue;
    const entry = merged.get(r.code) ?? { canUse: false, canInput: false };
    merged.set(r.code, {
      canUse: entry.canUse || descendantsMatch(r.id, (e) => e.canUse),
      canInput: entry.canInput,
    });
  }
}

export async function getPermissionResourcesByScope(scope: 'group' | 'role') {
  return prisma.permissionResource.findMany({
    where: { scope },
    select: { id: true, code: true, parentId: true, scope: true },
  });
}

export function hasPermission(
  permissions: PermissionMap,
  code: string,
  action: 'use' | 'input'
): boolean {
  const entry = permissions[code];
  if (!entry) return false;
  return action === 'use' ? entry.canUse : entry.canInput;
}

/** フィールド入力権限（旧 startDate / endDate コードとの互換を含む） */
export function hasFieldInputPermission(permissions: PermissionMap, code: string): boolean {
  return codesForFieldInputCheck(code).some((c) => hasPermission(permissions, c, 'input'));
}

function fieldValueChanged(bodyKey: string, oldVal: unknown, newVal: unknown): boolean {
  if (oldVal === undefined && newVal === undefined) return false;
  if (oldVal == null && (newVal == null || newVal === '')) return false;
  if (newVal == null && oldVal == null) return false;

  if (bodyKey === 'startDate' || bodyKey === 'endDate' || bodyKey === 'dueDate') {
    const oldParts = datetimeParts(oldVal as Date | string | null | undefined);
    const newParts = datetimeParts(newVal as string | null | undefined);
    if (bodyKey === 'dueDate') {
      return oldParts.date !== newParts.date;
    }
    return oldParts.date !== newParts.date || oldParts.time !== newParts.time;
  }

  const numericKeys = new Set([
    'trackerId',
    'statusId',
    'priorityId',
    'assignedToId',
    'assignedToGroupId',
    'estimatedHours',
    'doneRatio',
  ]);
  if (numericKeys.has(bodyKey)) {
    const o = oldVal == null || oldVal === '' ? null : Number(oldVal);
    const n = newVal == null || newVal === '' ? null : Number(newVal);
    return o !== n;
  }

  if (bodyKey === 'assignedToIds' || bodyKey === 'parentIds' || bodyKey === 'childIds') {
    const toSorted = (v: unknown): number[] => {
      if (!Array.isArray(v)) return [];
      return [...new Set(v.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))].sort(
        (a, b) => a - b,
      );
    };
    const o = toSorted(oldVal);
    const n = toSorted(newVal);
    if (o.length !== n.length) return true;
    return o.some((id, i) => id !== n[i]);
  }

  return String(oldVal ?? '') !== String(newVal ?? '');
}

export function assertFieldPermissions(
  permissions: PermissionMap,
  body: Record<string, unknown>,
  fieldMap: Record<string, string>,
  existing?: Record<string, unknown>
): string | null {
  for (const [bodyKey, permCode] of Object.entries(fieldMap)) {
    if (!(bodyKey in body) || body[bodyKey] === undefined) continue;
    if (existing && !fieldValueChanged(bodyKey, existing[bodyKey], body[bodyKey])) continue;
    if (!hasFieldInputPermission(permissions, permCode)) {
      return permCode;
    }
  }
  return null;
}

const DATETIME_FIELD_PERMS = {
  startDate: 'projects.issues.fields.startDateTime',
  endDate: 'projects.issues.fields.endDateTime',
} as const;

function datetimeParts(value: Date | string | null | undefined): { date: string | null; time: string | null } {
  if (value == null || value === '') return { date: null, time: null };
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

/** startDate / endDate の日付・時刻を別々に権限検証 */
export function assertDatetimeFieldPermissions(
  permissions: PermissionMap,
  body: Record<string, unknown>,
  existing: { startDate?: Date | null; endDate?: Date | null }
): string | null {
  for (const fieldKey of ['startDate', 'endDate'] as const) {
    if (!(fieldKey in body)) continue;
    const permCode = DATETIME_FIELD_PERMS[fieldKey];
    const oldParts = datetimeParts(existing[fieldKey] ?? null);
    const newParts = datetimeParts(
      body[fieldKey] === null || body[fieldKey] === '' ? null : (body[fieldKey] as string)
    );
    if (oldParts.date === newParts.date && oldParts.time === newParts.time) continue;
    if (!hasFieldInputPermission(permissions, permCode)) {
      return permCode;
    }
  }
  return null;
}

export { prisma as permissionPrisma };
