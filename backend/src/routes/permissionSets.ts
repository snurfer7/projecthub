import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/permissions';
import { clearPermissionCache } from '../services/permissions';

const router = Router();
const prisma = new PrismaClient();

function buildResourceTree(
  resources: Array<{
    id: number;
    code: string;
    name: string;
    resourceType: string;
    scope?: string;
    parentId: number | null;
    position: number;
  }>,
  rootParentIds: Array<number | null> = [null]
) {
  const byParent = new Map<number | null, typeof resources>();
  const idSet = new Set(resources.map((r) => r.id));
  for (const r of resources) {
    const parentKey =
      r.parentId != null && idSet.has(r.parentId) ? r.parentId : null;
    const list = byParent.get(parentKey) ?? [];
    list.push(r);
    byParent.set(parentKey, list);
  }
  function build(parentId: number | null): any[] {
    return (byParent.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code))
      .map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        resourceType: r.resourceType,
        scope: r.scope ?? 'group',
        position: r.position,
        children: build(r.id),
      }));
  }
  if (rootParentIds.length === 1 && rootParentIds[0] === null) {
    return build(null);
  }
  // For role scope: include virtual parent headings that are group-scoped (e.g. projects)
  return rootParentIds.flatMap((pid) => build(pid));
}

router.get('/permissions/resources', requireAnyPermission(['admin.permission-sets', 'admin.roles'], 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const scope = req.query.scope === 'role' ? 'role' : req.query.scope === 'all' ? 'all' : 'group';
    if (scope === 'all') {
      const resources = await prisma.permissionResource.findMany({
        orderBy: [{ position: 'asc' }, { code: 'asc' }],
      });
      res.json(buildResourceTree(resources));
      return;
    }
    if (scope === 'role') {
      // Include group-scoped parents of role resources as headings (e.g. projects)
      const roleResources = await prisma.permissionResource.findMany({
        where: { scope: 'role' },
        orderBy: [{ position: 'asc' }, { code: 'asc' }],
      });
      const parentIds = [...new Set(roleResources.map((r) => r.parentId).filter((id): id is number => id != null))];
      const parents = parentIds.length
        ? await prisma.permissionResource.findMany({ where: { id: { in: parentIds } } })
        : [];
      // Role resources that are also parents of other role resources (e.g. projects.issues)
      // must appear only once — otherwise the tree duplicates and createMany hits unique constraints.
      const byId = new Map<number, (typeof roleResources)[0] | (typeof parents)[0]>();
      for (const r of [...parents, ...roleResources]) {
        byId.set(r.id, r);
      }
      res.json(buildResourceTree([...byId.values()]));
      return;
    }
    const resources = await prisma.permissionResource.findMany({
      where: { scope: 'group' },
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
    });
    res.json(buildResourceTree(resources));
  } catch (e) {
    res.status(500).json({ error: '権限カタログの取得に失敗しました' });
  }
});

router.get('/permission-sets', requirePermission('admin.permission-sets', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const sets = await prisma.permissionSet.findMany({
      include: {
        groups: { select: { id: true, name: true } },
        _count: { select: { groups: true, permissions: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(sets);
  } catch (e) {
    res.status(500).json({ error: '権限設定の取得に失敗しました' });
  }
});

router.get('/permission-sets/:id', requirePermission('admin.permission-sets', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const set = await prisma.permissionSet.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        groups: { select: { id: true, name: true } },
        permissions: {
          include: { resource: { select: { id: true, code: true, name: true, resourceType: true } } },
        },
      },
    });
    if (!set) {
      res.status(404).json({ error: '権限設定が見つかりません' });
      return;
    }
    res.json(set);
  } catch (e) {
    res.status(500).json({ error: '権限設定の取得に失敗しました' });
  }
});

async function syncGroupAssignments(permissionSetId: number, groupIds?: number[]) {
  if (groupIds === undefined) return;
  await prisma.group.updateMany({
    where: { permissionSetId },
    data: { permissionSetId: null },
  });
  if (groupIds.length > 0) {
    await prisma.group.updateMany({
      where: { id: { in: groupIds } },
      data: { permissionSetId },
    });
  }
}

async function syncPermissions(
  permissionSetId: number,
  permissions?: Array<{ resourceId: number; canUse: boolean; canInput: boolean }>
) {
  if (permissions === undefined) return;
  // Only allow group-scoped resources on PermissionSets
  const groupIds = new Set(
    (await prisma.permissionResource.findMany({ where: { scope: 'group' }, select: { id: true } })).map((r) => r.id)
  );
  const filtered = (permissions ?? []).filter((p) => groupIds.has(p.resourceId));
  await prisma.permissionSetPermission.deleteMany({ where: { permissionSetId } });
  if (filtered.length > 0) {
    await prisma.permissionSetPermission.createMany({
      data: filtered.map((p) => ({
        permissionSetId,
        resourceId: p.resourceId,
        canUse: p.canUse,
        canInput: p.canInput && p.canUse,
      })),
    });
  }
  clearPermissionCache();
}

router.post('/permission-sets', requirePermission('admin.permission-sets', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, groupIds, permissions } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: '名前は必須です' });
      return;
    }
    const set = await prisma.permissionSet.create({
      data: { name: name.trim(), description: description?.trim() || null },
    });
    await syncGroupAssignments(set.id, groupIds);
    await syncPermissions(set.id, permissions);
    const result = await prisma.permissionSet.findUnique({
      where: { id: set.id },
      include: {
        groups: { select: { id: true, name: true } },
        permissions: { include: { resource: true } },
      },
    });
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(400).json({ error: '同名の権限設定が既に存在します' });
      return;
    }
    res.status(500).json({ error: '権限設定の作成に失敗しました' });
  }
});

router.put('/permission-sets/:id', requirePermission('admin.permission-sets', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, description, groupIds, permissions } = req.body;
    const existing = await prisma.permissionSet.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: '権限設定が見つかりません' });
      return;
    }
    await prisma.permissionSet.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });
    await syncGroupAssignments(id, groupIds);
    await syncPermissions(id, permissions);
    const result = await prisma.permissionSet.findUnique({
      where: { id },
      include: {
        groups: { select: { id: true, name: true } },
        permissions: { include: { resource: true } },
      },
    });
    res.json(result);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(400).json({ error: '同名の権限設定が既に存在します' });
      return;
    }
    res.status(500).json({ error: '権限設定の更新に失敗しました' });
  }
});

router.delete('/permission-sets/:id', requirePermission('admin.permission-sets', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.group.updateMany({ where: { permissionSetId: id }, data: { permissionSetId: null } });
    await prisma.permissionSet.delete({ where: { id } });
    clearPermissionCache();
    res.json({ message: '権限設定を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '権限設定の削除に失敗しました' });
  }
});

export default router;
