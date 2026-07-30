import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import {
  hasProjectPermission,
  PROJECT_PERMISSION_DENIED_MESSAGE,
  requireProjectPermission,
} from '../services/projectPermissions';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List wiki pages for project
router.get(
  '/project/:projectId',
  requirePermission('projects', 'use'),
  requireProjectPermission('projects.wiki', 'use', { paramName: 'projectId' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const pages = await prisma.wikiPage.findMany({
        where: { projectId: Number(req.params.projectId) },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [
          { position: 'asc' },
          { title: 'asc' }
        ],
      });
      res.json(pages);
    } catch (e) {
      res.status(500).json({ error: 'Wikiページの取得に失敗しました' });
    }
  }
);

// Get wiki page
router.get('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { id: Number(req.params.id) },
      include: { author: { select: { id: true, firstName: true, lastName: true } }, project: { select: { id: true, name: true } } },
    });
    if (!page) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, page.projectId, 'projects.wiki', 'use'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
    res.json(page);
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの取得に失敗しました' });
  }
});

// Create wiki page
router.post('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, title, content, parentId } = req.body;
    if (!(await hasProjectPermission(req.userId!, Number(projectId), 'projects.wiki', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
    const page = await prisma.wikiPage.create({
      data: {
        projectId,
        title,
        content,
        authorId: req.userId!,
        parentId: parentId ? Number(parentId) : null
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(page);
  } catch (e) {
    console.error('wiki.createPage error:', e);
    res.status(500).json({ error: 'Wikiページの作成に失敗しました' });
  }
});

// Update wiki page
router.put('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.wikiPage.findUnique({
      where: { id: Number(req.params.id) },
      select: { projectId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, existing.projectId, 'projects.wiki', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }

    const { title, content, parentId } = req.body;
    const page = await prisma.wikiPage.update({
      where: { id: Number(req.params.id) },
      data: {
        title,
        content,
        parentId: parentId ? Number(parentId) : (parentId === null ? null : undefined)
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(page);
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの更新に失敗しました' });
  }
});

// Delete wiki page
router.delete('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.wikiPage.findUnique({
      where: { id: Number(req.params.id) },
      select: { projectId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, existing.projectId, 'projects.wiki', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
    await prisma.wikiPage.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Wikiページを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの削除に失敗しました' });
  }
});

// Move wiki page (change parent and/or position)
router.patch('/:id/move', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.wikiPage.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, existing.projectId, 'projects.wiki', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }

    const { parentId, position } = req.body;

    const page = await prisma.wikiPage.update({
      where: { id },
      data: {
        parentId: parentId === undefined ? undefined : parentId,
        position: position === undefined ? undefined : Number(position)
      }
    });
    res.json(page);
  } catch (e) {
    console.error('wiki.movePage error:', e);
    res.status(500).json({ error: 'Wikiページの移動に失敗しました' });
  }
});

export default router;
