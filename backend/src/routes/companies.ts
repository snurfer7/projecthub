import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List companies (used by project creation dropdown)
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        locations: true,
        contacts: true,
        _count: { select: { projects: true, wikiPages: true, comments: true, locations: true } }
      },
      orderBy: { name: 'asc' },
    });
    res.json(companies);
  } catch (e) {
    console.error('companies.getCompanies error:', e);
    res.status(500).json({ error: '企業の取得に失敗しました' });
  }
});

// Get company details with associations
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        projects: { select: { id: true, name: true, identifier: true, status: true } },
        associations: {
          include: { association: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { comments: true, wikiPages: true, projects: true, locations: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: '企業が見つかりません' });
    }

    res.json(company);
  } catch (e) {
    console.error('companies.getCompanyDetail error:', e);
    res.status(500).json({ error: '企業の取得に失敗しました' });
  }
});

// Add association to company
router.post('/:companyId/associations/:associationId', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const associationId = Number(req.params.associationId);

    const companyAssociation = await prisma.companyAssociation.create({
      data: {
        companyId,
        associationId,
      },
      include: { association: true },
    });

    res.status(201).json(companyAssociation);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'この協会は既に割り当てられています' });
    }
    res.status(500).json({ error: '協会の割り当てに失敗しました' });
  }
});

// Remove association from company
router.delete('/:companyId/associations/:associationId', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const associationId = Number(req.params.associationId);

    await prisma.companyAssociation.deleteMany({
      where: {
        companyId,
        associationId,
      },
    });

    res.json({ message: '協会の割り当てを削除しました' });
  } catch (e) {
    res.status(500).json({ error: '協会の削除に失敗しました' });
  }
});
// ==========================================
// Comments
// ==========================================

// Get comments for a company
router.get('/:companyId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const comments = await prisma.companyComment.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: 'コメントの取得に失敗しました' });
  }
});

// Add a comment to a company
router.post('/:companyId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'コメント内容が必要です' });
    }

    const comment = await prisma.companyComment.create({
      data: {
        companyId,
        userId: req.userId!,
        content,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: 'コメントの追加に失敗しました' });
  }
});

// Update a comment
router.put('/:companyId/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const { content } = req.body;

    const existing = await prisma.companyComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'コメントが見つかりません' });
    }

    if (existing.userId !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user?.isAdmin) {
        return res.status(403).json({ error: '編集権限がありません' });
      }
    }

    const comment = await prisma.companyComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: 'コメントの更新に失敗しました' });
  }
});

// Delete a comment

// ==========================================
// Wiki Pages
// ==========================================

// Get all wiki pages for a company
router.get('/:companyId/wiki', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const pages = await prisma.companyWikiPage.findMany({
      where: { companyId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
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

// Get a specific wiki page by title
router.get('/:companyId/wiki/:title', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;

    const page = await prisma.companyWikiPage.findUnique({
      where: {
        companyId_title: {
          companyId,
          title,
        },
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!page) {
      return res.status(404).json({ error: 'Wikiページが見つかりません' });
    }

    res.json(page);
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの取得に失敗しました' });
  }
});

// Create or update a wiki page
router.put('/:companyId/wiki/:title', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;
    const { content, parentId } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'コンテンツが必要です' });
    }

    const page = await prisma.companyWikiPage.upsert({
      where: {
        companyId_title: {
          companyId,
          title,
        },
      },
      update: {
        content,
        authorId: req.userId!,
        parentId: parentId ? Number(parentId) : (parentId === null ? null : undefined)
      },
      create: {
        companyId,
        title,
        content,
        authorId: req.userId!,
        parentId: parentId ? Number(parentId) : null
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(page);
  } catch (e) {
    console.error('companies.saveWikiPage error:', e);
    res.status(500).json({ error: 'Wikiページの保存に失敗しました' });
  }
});

// Delete a wiki page
router.delete('/:companyId/wiki/:title', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;

    await prisma.companyWikiPage.delete({
      where: {
        companyId_title: {
          companyId,
          title,
        },
      },
    });

    res.json({ message: 'Wikiページを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'Wikiページの削除に失敗しました' });
  }
});

// Move company wiki page
router.patch('/:companyId/wiki/:title/move', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const title = req.params.title as string;
    const { parentId, position } = req.body;

    const page = await prisma.companyWikiPage.update({
      where: {
        companyId_title: {
          companyId,
          title
        }
      },
      data: {
        parentId: parentId === undefined ? undefined : parentId,
        position: position === undefined ? undefined : Number(position)
      }
    });
    res.json(page);
  } catch (e) {
    console.error('companies.moveWikiPage error:', e);
    res.status(500).json({ error: 'Wikiページの移動に失敗しました' });
  }
});

// ==========================================
// Locations
// ==========================================

// Get all locations for a company
router.get('/:companyId/locations', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const locations = await prisma.location.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(locations);
  } catch (e) {
    res.status(500).json({ error: '拠点の取得に失敗しました' });
  }
});

// Create a location
router.post('/:companyId/locations', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.companyId);
    const { name, phone, postalCode, prefecture, city, street, building, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: '拠点名が必要です' });
    }

    const location = await prisma.location.create({
      data: {
        companyId,
        name,
        phone,
        postalCode,
        prefecture,
        city,
        street,
        building,
        notes,
      },
    });

    res.status(201).json(location);
  } catch (e) {
    res.status(500).json({ error: '拠点の作成に失敗しました' });
  }
});

// Update a location
router.put('/:companyId/locations/:locationId', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = Number(req.params.locationId);
    const { name, phone, postalCode, prefecture, city, street, building, notes } = req.body;

    const location = await prisma.location.update({
      where: { id: locationId },
      data: {
        name,
        phone,
        postalCode,
        prefecture,
        city,
        street,
        building,
        notes,
      },
    });

    res.json(location);
  } catch (e) {
    res.status(500).json({ error: '拠点の更新に失敗しました' });
  }
});

// Delete a location
router.delete('/:companyId/locations/:locationId', async (req: AuthRequest, res: Response) => {
  try {
    const locationId = Number(req.params.locationId);

    await prisma.location.delete({
      where: { id: locationId },
    });

    res.json({ message: '拠点を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '拠点の削除に失敗しました' });
  }
});

export default router;
