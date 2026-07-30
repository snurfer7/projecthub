import { PrismaClient } from '@prisma/client';
import { assertPermissionPrismaClient } from './lib/assertPrismaClient';
import { loadPermissionCatalog } from './lib/loadPermissionCatalog';

const { flattenPermissionCatalog } = loadPermissionCatalog();

const prisma = new PrismaClient();

export async function seedPermissions() {
  assertPermissionPrismaClient(prisma);
  const flat = flattenPermissionCatalog();
  const catalogCodes = new Set(flat.map((e) => e.code));
  const codeToId = new Map<string, number>();

  for (const entry of flat) {
    const parentId = entry.parentCode ? codeToId.get(entry.parentCode) : undefined;
    const scope = entry.scope ?? 'group';
    const existing = await prisma.permissionResource.findUnique({ where: { code: entry.code } });
    if (existing) {
      await prisma.permissionResource.update({
        where: { id: existing.id },
        data: {
          name: entry.name,
          resourceType: entry.resourceType,
          scope,
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
          resourceType: entry.resourceType ?? 'feature',
          scope,
          position: entry.position,
          parentId: parentId ?? null,
        },
      });
      codeToId.set(entry.code, created.id);
    }
  }

  const obsoleteCodes = [
    'projects.issues.fields.startDate',
    'projects.issues.fields.endDate',
    'projects.issues.fields.startDateTime.date',
    'projects.issues.fields.startDateTime.time',
    'projects.issues.fields.endDateTime.date',
    'projects.issues.fields.endDateTime.time',
  ];

  const migrateFromTo: Array<{ from: string; to: string }> = [
    { from: 'projects.issues.fields.startDate', to: 'projects.issues.fields.startDateTime' },
    { from: 'projects.issues.fields.endDate', to: 'projects.issues.fields.endDateTime' },
    { from: 'projects.issues.fields.startDateTime.date', to: 'projects.issues.fields.startDateTime' },
    { from: 'projects.issues.fields.startDateTime.time', to: 'projects.issues.fields.startDateTime' },
    { from: 'projects.issues.fields.endDateTime.date', to: 'projects.issues.fields.endDateTime' },
    { from: 'projects.issues.fields.endDateTime.time', to: 'projects.issues.fields.endDateTime' },
  ];

  for (const { from, to } of migrateFromTo) {
    const fromResource = await prisma.permissionResource.findUnique({ where: { code: from } });
    const toId = codeToId.get(to);
    if (!fromResource || !toId) continue;
    const fromPerms = await prisma.permissionSetPermission.findMany({
      where: { resourceId: fromResource.id },
    });
    for (const fp of fromPerms) {
      const existing = await prisma.permissionSetPermission.findUnique({
        where: { permissionSetId_resourceId: { permissionSetId: fp.permissionSetId, resourceId: toId } },
      });
      await prisma.permissionSetPermission.upsert({
        where: {
          permissionSetId_resourceId: {
            permissionSetId: fp.permissionSetId,
            resourceId: toId,
          },
        },
        create: {
          permissionSetId: fp.permissionSetId,
          resourceId: toId,
          canUse: fp.canUse,
          canInput: fp.canInput,
        },
        update: {
          canUse: existing ? existing.canUse || fp.canUse : fp.canUse,
          canInput: existing ? existing.canInput || fp.canInput : fp.canInput,
        },
      });
    }
    await prisma.permissionResource.delete({ where: { id: fromResource.id } });
  }

  const allInDb = await prisma.permissionResource.findMany();
  for (const r of allInDb) {
    if (!catalogCodes.has(r.code) && !obsoleteCodes.includes(r.code)) {
      await prisma.permissionResource.delete({ where: { id: r.id } });
    }
  }

  const groupResources = await prisma.permissionResource.findMany({ where: { scope: 'group' } });
  const roleResources = await prisma.permissionResource.findMany({ where: { scope: 'role' } });

  // Remove role-scoped rows from PermissionSets
  if (roleResources.length > 0) {
    await prisma.permissionSetPermission.deleteMany({
      where: { resourceId: { in: roleResources.map((r) => r.id) } },
    });
  }

  // Grant full role permissions to all roles
  const roles = await prisma.role.findMany({ select: { id: true } });
  for (const role of roles) {
    for (const resource of roleResources) {
      await prisma.rolePermission.upsert({
        where: { roleId_resourceId: { roleId: role.id, resourceId: resource.id } },
        create: {
          roleId: role.id,
          resourceId: resource.id,
          canUse: true,
          canInput: true,
        },
        update: { canUse: true, canInput: true },
      });
    }
  }

  const isInitialBootstrap = (await prisma.permissionSet.count()) === 0;

  let fullAccessSet = await prisma.permissionSet.findUnique({ where: { name: '全権限' } });
  let defaultGroup = await prisma.group.findUnique({ where: { name: 'デフォルト' } });

  if (isInitialBootstrap) {
    fullAccessSet = await prisma.permissionSet.create({
      data: { name: '全権限', description: 'すべての機能・項目へのアクセス' },
    });

    for (const resource of groupResources) {
      await prisma.permissionSetPermission.create({
        data: {
          permissionSetId: fullAccessSet.id,
          resourceId: resource.id,
          canUse: true,
          canInput: true,
        },
      });
    }

    defaultGroup = await prisma.group.create({
      data: { name: 'デフォルト', permissionSetId: fullAccessSet.id },
    });

    await prisma.group.updateMany({
      where: { permissionSetId: null },
      data: { permissionSetId: fullAccessSet.id },
    });

    const allUsers = await prisma.user.findMany({ select: { id: true } });
    for (const user of allUsers) {
      await prisma.groupMember.create({
        data: { groupId: defaultGroup.id, userId: user.id },
      });
    }

    console.log(
      `Seeded ${groupResources.length} group + ${roleResources.length} role permission resources; created 全権限 and デフォルト group (initial bootstrap)`
    );
    return { fullAccessSet, defaultGroup };
  }

  if (fullAccessSet) {
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

  console.log(
    `Seeded ${groupResources.length} group + ${roleResources.length} role permission resources` +
      (fullAccessSet ? ' (updated existing 全権限)' : ' (全権限なし・作成スキップ)')
  );
  return { fullAccessSet, defaultGroup };
}

if (require.main === module) {
  seedPermissions()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
