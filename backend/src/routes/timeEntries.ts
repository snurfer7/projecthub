import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { parseNumericQueryIds } from '../utils/queryParams';
import {
  getAccessibleProjectIds,
  isRequestAdmin,
  sendProjectAccessDenied,
} from '../services/projectAccess';
import {
  getProjectIdsWithPermission,
  hasProjectPermission,
  PROJECT_PERMISSION_DENIED_MESSAGE,
} from '../services/projectPermissions';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List time entries
router.get('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, issueId, userId, userIds, startDate, endDate } = req.query;
    const accessibleIds = await getAccessibleProjectIds(req.userId!, isRequestAdmin(req));
    const permittedIds = await getProjectIdsWithPermission(req.userId!, accessibleIds, 'projects.time-entries', 'use');
    const where: any = {};

    if (projectId) {
      const pid = Number(projectId);
      if (!accessibleIds.includes(pid)) {
        sendProjectAccessDenied(res);
        return;
      }
      if (!permittedIds.includes(pid)) {
        res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
        return;
      }
      where.projectId = pid;
    } else {
      where.projectId = { in: permittedIds };
    }

    if (issueId) where.issueId = Number(issueId);
    const recordUserIds = parseNumericQueryIds(userIds ?? userId);
    if (recordUserIds.length > 0) where.userId = { in: recordUserIds };
    if (startDate || endDate) {
      where.spentOn = {};
      if (startDate) where.spentOn.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.spentOn.lte = end;
      }
    }

    if (permittedIds.length === 0) {
      res.json([]);
      return;
    }

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
router.post('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, issueId, hours, activity, spentOn, comments } = req.body;
    if (!(await hasProjectPermission(req.userId!, Number(projectId), 'projects.time-entries', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
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
router.put('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.timeEntry.findUnique({
      where: { id: Number(req.params.id) },
      select: { projectId: true },
    });
    if (!existing) {
      res.status(404).json({ error: '時間記録が見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, existing.projectId, 'projects.time-entries', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }

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
router.delete('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.timeEntry.findUnique({
      where: { id: Number(req.params.id) },
      select: { projectId: true },
    });
    if (!existing) {
      res.status(404).json({ error: '時間記録が見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, existing.projectId, 'projects.time-entries', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
    await prisma.timeEntry.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '時間記録を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '時間記録の削除に失敗しました' });
  }
});

export default router;
