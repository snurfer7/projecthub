import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, requirePermission('home', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    let homePage = await prisma.homePage.findFirst();

    if (!homePage) {
      homePage = await prisma.homePage.create({
        data: {
          content: '# ホームページ\n\nこのページはmarkdownで編集可能です.',
        },
      });
    }

    res.json(homePage);
  } catch (error) {
    console.error('Error fetching home page:', error);
    res.status(500).json({ error: 'Failed to fetch home page' });
  }
});

router.post('/', authenticateToken, requirePermission('home', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Content is required and must be a string' });
      return;
    }

    let homePage = await prisma.homePage.findFirst();

    if (!homePage) {
      homePage = await prisma.homePage.create({
        data: { content },
      });
    } else {
      homePage = await prisma.homePage.update({
        where: { id: homePage.id },
        data: { content },
      });
    }

    res.json(homePage);
  } catch (error) {
    console.error('Error updating home page:', error);
    res.status(500).json({ error: 'Failed to update home page' });
  }
});

export default router;
