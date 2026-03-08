import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List wiki pages for project
router.get('/project/:projectId', async (req: AuthRequest, res: Response) => {
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
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { id: Number(req.params.id) },
      include: { author: { select: { id: true, firstName: true, lastName: true } }, project: { select: { id: true, name: true } } },
    });
    if (!page) {
      res.status(404).json({ error: 'Wikiページが見つかりません' });
      return;
    }
    res.json(page);
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの取得に失敗しました' });
  }
});

// Create wiki page
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, title, content, parentId } = req.body;
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
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
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
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.wikiPage.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Wikiページを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの削除に失敗しました' });
  }
});

// Move wiki page (change parent and/or position)
router.patch('/:id/move', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
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
