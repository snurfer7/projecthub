import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET ホームページコンテンツを取得
router.get('/', async (_req, res) => {
  try {
    let homePage = await prisma.homePage.findFirst();
    
    // ホームページが存在しない場合は作成
    if (!homePage) {
      homePage = await prisma.homePage.create({
        data: {
          content: '# ホームページ\n\nこのページはmarkdownで編集可能です。'
        }
      });
    }
    
    res.json(homePage);
  } catch (error) {
    console.error('Error fetching home page:', error);
    res.status(500).json({ error: 'Failed to fetch home page' });
  }
});

// POST ホームページコンテンツを更新
router.post('/', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required and must be a string' });
    }

    let homePage = await prisma.homePage.findFirst();

    if (!homePage) {
      homePage = await prisma.homePage.create({
        data: { content }
      });
    } else {
      homePage = await prisma.homePage.update({
        where: { id: homePage.id },
        data: { content }
      });
    }

    res.json(homePage);
  } catch (error) {
    console.error('Error updating home page:', error);
    res.status(500).json({ error: 'Failed to update home page' });
  }
});

export default router;
