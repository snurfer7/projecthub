import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG, flattenPermissionCatalog } from '../constants/permissionCatalog';
import {
  clearProjectPermissionCache,
  grantFullRolePermissionsToAllRoles,
  pruneRoleScopedFromPermissionSets,
} from './projectPermissions';
import { clearPermissionCache } from './permissions';

const prisma = new PrismaClient();

/**
 * 権限カタログ（permissionCatalog.ts）の内容を DB の PermissionResource テーブルに同期する。
 * 新規エントリは追加、既存は名前・位置・scope を更新、カタログから削除されたものは DB からも削除する。
 * 「全権限」が既に存在する場合のみ、グループ向けリソースを全許可で追記する。
 * ロール向けリソースは全 Role に全権限を upsert し、PermissionSet から role-scope を除去する。
 */
export async function syncPermissionCatalog(): Promise<void> {
  const flat = flattenPermissionCatalog(PERMISSION_CATALOG);
  const catalogCodes = new Set(flat.map((e) => e.code));
  const codeToId = new Map<string, number>();

  for (const entry of flat) {
    const parentId = entry.parentCode ? codeToId.get(entry.parentCode) : undefined;
    const existing = await prisma.permissionResource.findUnique({ where: { code: entry.code } });
    if (existing) {
      await prisma.permissionResource.update({
        where: { id: existing.id },
        data: {
          name: entry.name,
          resourceType: entry.resourceType,
          scope: entry.scope,
          position: entry.position,
          parentId: parentId ?? null,
        },
      });
      codeToId.set(entry.code, existing.id);
    } else {
      const created = await prisma.permissionResource.create({
        data: {
          code: entry.code,
          name: entry.name,
          resourceType: entry.resourceType,
          scope: entry.scope,
          position: entry.position,
          parentId: parentId ?? null,
        },
      });
      codeToId.set(entry.code, created.id);
    }
  }

  const allInDb = await prisma.permissionResource.findMany();
  for (const r of allInDb) {
    if (!catalogCodes.has(r.code)) {
      await prisma.permissionResource.delete({ where: { id: r.id } });
    }
  }

  clearPermissionCache();
  clearProjectPermissionCache();

  await pruneRoleScopedFromPermissionSets();
  await grantFullRolePermissionsToAllRoles();

  const fullAccessSet = await prisma.permissionSet.findUnique({ where: { name: '全権限' } });
  if (!fullAccessSet) {
    return;
  }

  const groupResources = await prisma.permissionResource.findMany({
    where: { scope: 'group' },
  });
  for (const resource of groupResources) {
    await prisma.permissionSetPermission.upsert({
      where: {
        permissionSetId_resourceId: {
          permissionSetId: fullAccessSet.id,
          resourceId: resource.id,
        },
      },
      create: {
        permissionSetId: fullAccessSet.id,
        resourceId: resource.id,
        canUse: true,
        canInput: true,
      },
      update: { canUse: true, canInput: true },
    });
  }
}
