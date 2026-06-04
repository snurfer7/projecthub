import { PrismaClient } from '@prisma/client';
import { codesForFieldInputCheck } from '../constants/fieldPermissionAliases';

export type PermissionEntry = { canUse: boolean; canInput: boolean };
export type PermissionMap = Record<string, PermissionEntry>;

const prisma = new PrismaClient();

let resourceTreeCache: Array<{
  id: number;
  code: string;
  parentId: number | null;
}> | null = null;

async function getResourceTree() {
  if (!resourceTreeCache) {
    resourceTreeCache = await prisma.permissionResource.findMany({
      select: { id: true, code: true, parentId: true },
    });
  }
  return resourceTreeCache;
}

export function clearPermissionCache() {
  resourceTreeCache = null;
}

function applyInheritance(
  merged: Map<string, PermissionEntry>,
  resources: Array<{ id: number; code: string; parentId: number | null }>
): PermissionMap {
  const byId = new Map(resources.map((r) => [r.id, r]));
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

export async function resolveUserPermissions(userId: number): Promise<PermissionMap> {
  const groupMembers = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          permissionSet: {
            include: {
              permissions: {
                include: { resource: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
  });

  const merged = new Map<string, PermissionEntry>();
  for (const gm of groupMembers) {
    const set = gm.group.permissionSet;
    if (!set) continue;
    for (const p of set.permissions) {
      const code = p.resource.code;
      const existing = merged.get(code) ?? { canUse: false, canInput: false };
      merged.set(code, {
        canUse: existing.canUse || p.canUse,
        canInput: existing.canInput || p.canInput,
      });
    }
  }

  const resources = await getResourceTree();
  boostParentPermissionsFromChildren(merged, resources);
  const inherited = applyInheritance(merged, resources);
  return expandLegacyFieldAliases(inherited);
}

/** DB に旧 startDate / endDate のみある場合も新フィールドコードで効くようにする */
function expandLegacyFieldAliases(map: PermissionMap): PermissionMap {
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

function boostParentPermissionsFromChildren(
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

  for (const r of resources) {
    if (!(childrenByParent.get(r.id)?.length)) continue;
    const entry = merged.get(r.code) ?? { canUse: false, canInput: false };
    merged.set(r.code, {
      canUse: entry.canUse || descendantsMatch(r.id, (e) => e.canUse),
      canInput: entry.canInput || descendantsMatch(r.id, (e) => e.canInput),
    });
  }
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
