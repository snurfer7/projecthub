import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { parseNumericQueryIds } from '../utils/queryParams';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Get gantt data for project
router.get('/project/:projectId', requirePermission('projects.gantt', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    const { trackerId, trackerIds, assignedToId, assignedToIds, statusId, statusIds } = req.query;

    // Get project with dueDate
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, dueDate: true, parentId: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }

    const where: any = {
      projectId: projectId,
      OR: [{ startDate: { not: null } }, { dueDate: { not: null } }],
    };
    const filterTrackerIds = parseNumericQueryIds(trackerIds ?? trackerId);
    if (filterTrackerIds.length > 0) where.trackerId = { in: filterTrackerIds };
    const assigneeIds = parseNumericQueryIds(assignedToIds ?? assignedToId);
    if (assigneeIds.length > 0) where.assignedToId = { in: assigneeIds };
    const filterStatusIds = parseNumericQueryIds(statusIds ?? statusId);
    if (filterStatusIds.length > 0) where.statusId = { in: filterStatusIds };

    const issues = await prisma.issue.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        tracker: true,
        status: true,
        priority: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        relationsFrom: true,
        _count: { select: { comments: true } },
      },
      orderBy: [{ position: 'asc' }, { startDate: 'asc' }],
    });

    res.json({ project, issues });
  } catch (e) {
    res.status(500).json({ error: 'ガントチャートデータの取得に失敗しました' });
  }
});

// Get gantt data for all projects
router.get('/all', requirePermission('projects.gantt', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { trackerId, trackerIds, assignedToId, assignedToIds, statusId, statusIds } = req.query;

    // Get all active projects
    const projects = await prisma.project.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        dueDate: true,
        parentId: true,
        companyId: true,
        relatedCompanies: {
          select: { companyId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const where: any = {
      OR: [{ startDate: { not: null } }, { dueDate: { not: null } }],
    };
    const filterTrackerIds = parseNumericQueryIds(trackerIds ?? trackerId);
    if (filterTrackerIds.length > 0) where.trackerId = { in: filterTrackerIds };
    const assigneeIds = parseNumericQueryIds(assignedToIds ?? assignedToId);
    if (assigneeIds.length > 0) where.assignedToId = { in: assigneeIds };
    const filterStatusIds = parseNumericQueryIds(statusIds ?? statusId);
    if (filterStatusIds.length > 0) where.statusId = { in: filterStatusIds };

    const issues = await prisma.issue.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        tracker: true,
        status: true,
        priority: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        relationsFrom: true,
        _count: { select: { comments: true } },
      },
      orderBy: [{ projectId: 'asc' }, { position: 'asc' }, { startDate: 'asc' }],
    });

    res.json({ projects, issues });
  } catch (e) {
    res.status(500).json({ error: 'ガントチャートデータの取得に失敗しました' });
  }
});

export default router;
