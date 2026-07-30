import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import {
  assertProjectMember,
  isRequestAdmin,
  ProjectAccessDeniedError,
  requireProjectMember,
  sendProjectAccessDenied,
} from '../services/projectAccess';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List wiki pages for project
router.get('/project/:projectId', requirePermission('projects.wiki', 'use'), requireProjectMember('projectId'), async (req: AuthRequest, res: Response) => {
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
});

// Get wiki page
router.get('/:id', requirePermission('projects.wiki', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { id: Number(req.params.id) },
      include: { author: { select: { id: true, firstName: true, lastName: true } }, project: { select: { id: true, name: true } } },
    });
    if (!page) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    await assertProjectMember(req.userId!, page.projectId, isRequestAdmin(req));
    res.json(page);
  } catch (e) {
    if (e instanceof ProjectAccessDeniedError) {
      sendProjectAccessDenied(res);
      return;
    }
    res.status(500).json({ error: 'Wikiページの取得に失敗しました' });
  }
});

// Create wiki page
router.post('/', requirePermission('projects.wiki', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, title, content, parentId } = req.body;
    await assertProjectMember(req.userId!, Number(projectId), isRequestAdmin(req));
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
    if (e instanceof ProjectAccessDeniedError) {
      sendProjectAccessDenied(res);
      return;
    }
    console.error('wiki.createPage error:', e);
    res.status(500).json({ error: 'Wikiページの作成に失敗しました' });
  }
});

// Update wiki page
router.put('/:id', requirePermission('projects.wiki', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.wikiPage.findUnique({
      where: { id: Number(req.params.id) },
      select: { projectId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    await assertProjectMember(req.userId!, existing.projectId, isRequestAdmin(req));

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
    if (e instanceof ProjectAccessDeniedError) {
      sendProjectAccessDenied(res);
      return;
    }
    res.status(500).json({ error: 'Wikiページの更新に失敗しました' });
  }
});

// Delete wiki page
router.delete('/:id', requirePermission('projects.wiki', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.wikiPage.findUnique({
      where: { id: Number(req.params.id) },
      select: { projectId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    await assertProjectMember(req.userId!, existing.projectId, isRequestAdmin(req));
    await prisma.wikiPage.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Wikiページを削除しました' });
  } catch (e) {
    if (e instanceof ProjectAccessDeniedError) {
      sendProjectAccessDenied(res);
      return;
    }
    res.status(500).json({ error: 'Wikiページの削除に失敗しました' });
  }
});

// Move wiki page (change parent and/or position)
router.patch('/:id/move', requirePermission('projects.wiki', 'input'), async (req: AuthRequest, res: Response) => {
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
    await assertProjectMember(req.userId!, existing.projectId, isRequestAdmin(req));

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
    if (e instanceof ProjectAccessDeniedError) {
      sendProjectAccessDenied(res);
      return;
    }
    console.error('wiki.movePage error:', e);
    res.status(500).json({ error: 'Wikiページの移動に失敗しました' });
  }
});

export default router;
