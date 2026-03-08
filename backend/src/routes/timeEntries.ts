import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List time entries
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, issueId, userId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = Number(projectId);
    if (issueId) where.issueId = Number(issueId);
    if (userId) where.userId = Number(userId);

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        issue: { select: { id: true, subject: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { spentOn: 'desc' },
    });
    res.json(entries);
  } catch (e) {
    res.status(500).json({ error: '時間記録の取得に失敗しました' });
  }
});

// Create time entry
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, issueId, hours, activity, spentOn, comments } = req.body;
    const entry = await prisma.timeEntry.create({
      data: {
        projectId,
        issueId: issueId || null,
        userId: req.userId!,
        hours: Number(hours),
        activity,
        spentOn: new Date(spentOn),
        comments,
      },
      include: {
        project: { select: { id: true, name: true } },
        issue: { select: { id: true, subject: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: '時間記録の作成に失敗しました' });
  }
});

// Update time entry
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { hours, activity, spentOn, comments } = req.body;
    const entry = await prisma.timeEntry.update({
      where: { id: Number(req.params.id) },
      data: {
        hours: hours ? Number(hours) : undefined,
        activity,
        spentOn: spentOn ? new Date(spentOn) : undefined,
        comments,
      },
      include: {
        project: { select: { id: true, name: true } },
        issue: { select: { id: true, subject: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(entry);
  } catch (e) {
    res.status(500).json({ error: '時間記録の更新に失敗しました' });
  }
});

// Delete time entry
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.timeEntry.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '時間記録を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '時間記録の削除に失敗しました' });
  }
});

export default router;
