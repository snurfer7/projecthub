import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const VALID_VIEW_MODES = ['list', 'gantt', 'kanban', 'time'] as const;
type ViewMode = (typeof VALID_VIEW_MODES)[number];

function isValidViewMode(v: unknown): v is ViewMode {
  return VALID_VIEW_MODES.includes(v as ViewMode);
}

// GET /api/saved-searches?viewMode=...
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { viewMode } = req.query;
    if (!isValidViewMode(viewMode)) {
      res.status(400).json({ error: 'viewMode は list, gantt, kanban, time のいずれかを指定してください' });
      return;
    }
    try {
      const searches = await prisma.savedSearch.findMany({
        where: { userId: req.userId!, viewMode },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      res.json(searches);
    } catch {
      res.status(500).json({ error: '保存済み検索の取得に失敗しました' });
    }
  },
);

// POST /api/saved-searches
router.post(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { viewMode, name, filter, isDefault } = req.body ?? {};
    if (!isValidViewMode(viewMode)) {
      res.status(400).json({ error: 'viewMode は list, gantt, kanban, time のいずれかを指定してください' });
      return;
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: '名称は必須です' });
      return;
    }
    try {
      let created;
      if (isDefault) {
        await prisma.$transaction(async (tx) => {
          await tx.savedSearch.updateMany({
            where: { userId: req.userId!, viewMode, isDefault: true },
            data: { isDefault: false },
          });
          created = await tx.savedSearch.create({
            data: {
              userId: req.userId!,
              viewMode,
              name: name.trim(),
              isDefault: true,
              filter: filter ?? {},
            },
          });
        });
      } else {
        created = await prisma.savedSearch.create({
          data: {
            userId: req.userId!,
            viewMode,
            name: name.trim(),
            isDefault: false,
            filter: filter ?? {},
          },
        });
      }
      res.status(201).json(created);
    } catch {
      res.status(500).json({ error: '保存済み検索の作成に失敗しました' });
    }
  },
);

// PUT /api/saved-searches/:id
router.put(
  '/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: '無効なIDです' });
      return;
    }
    const existing = await prisma.savedSearch.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId!) {
      res.status(404).json({ error: '保存済み検索が見つかりません' });
      return;
    }

    const { name, filter, isDefault } = req.body ?? {};
    try {
      let updated;
      const shouldSetDefault = isDefault === true;
      if (shouldSetDefault) {
        await prisma.$transaction(async (tx) => {
          await tx.savedSearch.updateMany({
            where: { userId: req.userId!, viewMode: existing.viewMode, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
          updated = await tx.savedSearch.update({
            where: { id },
            data: {
              ...(name !== undefined && typeof name === 'string' && name.trim() !== '' ? { name: name.trim() } : {}),
              ...(filter !== undefined ? { filter } : {}),
              isDefault: true,
            },
          });
        });
      } else {
        updated = await prisma.savedSearch.update({
          where: { id },
          data: {
            ...(name !== undefined && typeof name === 'string' && name.trim() !== '' ? { name: name.trim() } : {}),
            ...(filter !== undefined ? { filter } : {}),
            ...(isDefault === false ? { isDefault: false } : {}),
          },
        });
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: '保存済み検索の更新に失敗しました' });
    }
  },
);

// DELETE /api/saved-searches/:id
router.delete(
  '/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: '無効なIDです' });
      return;
    }
    const existing = await prisma.savedSearch.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId!) {
      res.status(404).json({ error: '保存済み検索が見つかりません' });
      return;
    }
    try {
      await prisma.savedSearch.delete({ where: { id } });
      res.status(204).end();
    } catch {
      res.status(500).json({ error: '保存済み検索の削除に失敗しました' });
    }
  },
);

export default router;
