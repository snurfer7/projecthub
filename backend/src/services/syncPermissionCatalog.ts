import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG, flattenPermissionCatalog } from '../constants/permissionCatalog';

const prisma = new PrismaClient();

/**
 * 権限カタログ（permissionCatalog.ts）の内容を DB の PermissionResource テーブルに同期する。
 * 新規エントリは追加、既存は名前・位置を更新、カタログから削除されたものは DB からも削除する。
 * 「全権限」権限セットに新規エントリを追加し、デフォルトグループに全ユーザーを追加する。
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

  const allResources = await prisma.permissionResource.findMany();

  let fullAccessSet = await prisma.permissionSet.findUnique({ where: { name: '全権限' } });
  if (!fullAccessSet) {
    fullAccessSet = await prisma.permissionSet.create({
      data: { name: '全権限', description: 'すべての機能・項目へのアクセス' },
    });
  }

  for (const resource of allResources) {
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

  let defaultGroup = await prisma.group.findUnique({ where: { name: 'デフォルト' } });
  if (!defaultGroup) {
    defaultGroup = await prisma.group.create({
      data: { name: 'デフォルト', permissionSetId: fullAccessSet.id },
    });
  } else {
    await prisma.group.update({
      where: { id: defaultGroup.id },
      data: { permissionSetId: fullAccessSet.id },
    });
  }

  await prisma.group.updateMany({
    where: { permissionSetId: null },
    data: { permissionSetId: fullAccessSet.id },
  });

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const user of allUsers) {
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: defaultGroup.id, userId: user.id } },
    });
    if (!existing) {
      await prisma.groupMember.create({
        data: { groupId: defaultGroup.id, userId: user.id },
      });
    }
  }
}
