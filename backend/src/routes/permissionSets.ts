import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { clearPermissionCache } from '../services/permissions';

const router = Router();
const prisma = new PrismaClient();

function buildResourceTree(
  resources: Array<{ id: number; code: string; name: string; resourceType: string; parentId: number | null; position: number }>
) {
  const byParent = new Map<number | null, typeof resources>();
  for (const r of resources) {
    const list = byParent.get(r.parentId) ?? [];
    list.push(r);
    byParent.set(r.parentId, list);
  }
  function build(parentId: number | null): any[] {
    return (byParent.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code))
      .map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        resourceType: r.resourceType,
        position: r.position,
        children: build(r.id),
      }));
  }
  return build(null);
}

router.get('/permissions/resources', requirePermission('admin.permission-sets', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const resources = await prisma.permissionResource.findMany({
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
  await prisma.permissionSetPermission.deleteMany({ where: { permissionSetId } });
  if (permissions.length > 0) {
    await prisma.permissionSetPermission.createMany({
      data: permissions.map((p) => ({
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
