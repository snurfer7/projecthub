import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getOrCreateSystemSetting, workCalendarDto } from '../services/systemCalendar';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

/** 営業時間・休日の参照専用（認証のみ） */
router.get('/calendar', async (_req: AuthRequest, res: Response) => {
  try {
    const setting = await getOrCreateSystemSetting(prisma);
    res.json(workCalendarDto(setting));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error fetching work calendar:', e);
    res.status(500).json({ error: 'カレンダー設定の取得に失敗しました', details: message });
  }
});

export default router;
