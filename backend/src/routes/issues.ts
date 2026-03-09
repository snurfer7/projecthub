import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List issues (with filters)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, statusId, trackerId, priorityId, assignedToId, assignedToGroupId } = req.query;
    const where: any = {};
    if (projectId && !isNaN(Number(projectId))) where.projectId = Number(projectId);
    if (statusId && String(statusId).trim() !== '' && !isNaN(Number(statusId))) where.statusId = Number(statusId);
    if (trackerId && String(trackerId).trim() !== '' && !isNaN(Number(trackerId))) where.trackerId = Number(trackerId);
    if (priorityId && String(priorityId).trim() !== '' && !isNaN(Number(priorityId))) where.priorityId = Number(priorityId);
    if (assignedToId && String(assignedToId).trim() !== '' && !isNaN(Number(assignedToId))) where.assignedToId = Number(assignedToId);
    if (assignedToGroupId && String(assignedToGroupId).trim() !== '' && !isNaN(Number(assignedToGroupId))) where.assignedToGroupId = Number(assignedToGroupId);

    const issues = await prisma.issue.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        assignedToGroup: { select: { id: true, name: true } },
        relationsFrom: true,
        relationsTo: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(issues);
  } catch (e) {
    console.error('Issue list error:', e);
    res.status(500).json({ error: 'チケットの取得に失敗しました' });
  }
});

// Reorder issues
router.put('/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { issues } = req.body; // Array of { id: number, position: number }
    if (!Array.isArray(issues)) {
      return res.status(400).json({ error: '不正なデータ形式です' });
    }

    await Promise.all(
      issues.map((issue: any) =>
        prisma.issue.update({
          where: { id: Number(issue.id) },
          data: { position: Number(issue.position) },
        })
      )
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Issue reorder error:', e);
    res.status(500).json({ error: '順序の更新に失敗しました' });
  }
});

// Get metadata (trackers, statuses, priorities, users, and optionally groups)
router.get('/meta/options', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    const [trackers, statuses, priorities] = await Promise.all([
      prisma.tracker.findMany({ orderBy: { position: 'asc' } as any }),
      prisma.issueStatus.findMany({ orderBy: { position: 'asc' } }),
      prisma.issuePriority.findMany({ orderBy: { position: 'asc' } }),
    ]);

    let users: { id: number; firstName: string; lastName: string }[] = [];
    let groups: { id: number; name: string }[] = [];

    if (projectId) {
      // Get explicit members and users who are in groups assigned to this project
      const [projectMembers, projectGroups] = await Promise.all([
        prisma.projectMember.findMany({
          where: { projectId: Number(projectId) },
          include: { user: { select: { id: true, firstName: true, lastName: true } } }
        }),
        (prisma as any).projectGroup.findMany({
          where: { projectId: Number(projectId) },
          include: { group: { select: { id: true, name: true } } }
        })
      ]);

      const userMap = new Map();
      for (const m of projectMembers) {
        userMap.set(m.user.id, m.user);
      }
      users = Array.from(userMap.values());
      groups = projectGroups.map((pg: any) => pg.group);
    } else {
      users = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } });
    }

    res.json({ trackers, statuses, priorities, users, groups });
  } catch (e) {
    console.error('メタデータ取得エラー:', e);
    res.status(500).json({ error: 'メタデータの取得に失敗しました' });
  }
});

// Get issue
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        project: { select: { id: true, name: true } },
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        assignedToGroup: { select: { id: true, name: true } },
        comments: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: { author: { select: { id: true, firstName: true, lastName: true } } },
        },
        timeEntries: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        relationsFrom: {
          include: {
            issueTo: {
              select: { id: true, subject: true, statusId: true, trackerId: true, status: true, tracker: true }
            }
          }
        },
        relationsTo: {
          include: {
            issueFrom: {
              select: { id: true, subject: true, statusId: true, trackerId: true, status: true, tracker: true }
            }
          }
        },
      },
    });
    if (!issue) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    res.json(issue);
  } catch (e) {
    res.status(500).json({ error: 'チケットの取得に失敗しました' });
  }
});

// Add relation
router.post('/:id/relations', async (req: AuthRequest, res: Response) => {
  try {
    const { issueToId, relationType } = req.body;
    const issueFromId = Number(req.params.id);

    const relation = await prisma.issueRelation.create({
      data: {
        issueFromId,
        issueToId: Number(issueToId),
        relationType: relationType || 'precedes',
      },
      include: {
        issueTo: { select: { id: true, subject: true } }
      }
    });
    res.status(201).json(relation);
  } catch (e) {
    console.error('Relation creation error:', e);
    res.status(500).json({ error: '関連付けの作成に失敗しました' });
  }
});

// Delete relation
router.delete('/relations/:relationId', async (req: AuthRequest, res: Response) => {
  try {
    const relationId = Number(req.params.relationId);
    await prisma.issueRelation.delete({
      where: { id: relationId }
    });
    res.json({ message: '関連付けを削除しました' });
  } catch (e: any) {
    console.error(`Relation deletion error (ID: ${req.params.relationId}):`, e);
    res.status(500).json({ error: '関連付けの削除に失敗しました' });
  }
});

// Create issue
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, trackerId, statusId, priorityId, assignedToId, assignedToGroupId, subject, description, startDate, dueDate, estimatedHours } = req.body;
    if (estimatedHours !== undefined && estimatedHours !== null && !Number.isInteger(Number(estimatedHours))) {
      return res.status(400).json({ error: '予定工数は整数で入力してください' });
    }

    const issue = await prisma.issue.create({
      data: {
        projectId,
        trackerId,
        statusId,
        priorityId,
        authorId: req.userId!,
        assignedToId: assignedToId || null,
        assignedToGroupId: assignedToGroupId || null,
        subject,
        description,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours: estimatedHours ? Math.round(Number(estimatedHours)) : null,
      },
      include: {
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(issue);
  } catch (e) {
    res.status(500).json({ error: 'チケットの作成に失敗しました' });
  }
});

// Update issue
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { trackerId, statusId, priorityId, assignedToId, assignedToGroupId, subject, description, startDate, dueDate, estimatedHours, doneRatio } = req.body;
    const data: any = {};
    if (estimatedHours !== undefined && estimatedHours !== null && !Number.isInteger(Number(estimatedHours))) {
      return res.status(400).json({ error: '予定工数は整数で入力してください' });
    }

    if (trackerId !== undefined) data.trackerId = trackerId;
    if (statusId !== undefined) data.statusId = statusId;
    if (priorityId !== undefined) data.priorityId = priorityId;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (assignedToGroupId !== undefined) data.assignedToGroupId = assignedToGroupId || null;
    if (subject !== undefined) data.subject = subject;
    if (description !== undefined) data.description = description;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (estimatedHours !== undefined) data.estimatedHours = estimatedHours ? Math.round(Number(estimatedHours)) : null;
    if (doneRatio !== undefined) data.doneRatio = Number(doneRatio);

    const issue = await prisma.issue.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        assignedToGroup: { select: { id: true, name: true } },
      },
    });
    res.json(issue);
  } catch (e) {
    console.error('チケット更新エラー:', e);
    res.status(500).json({ error: 'チケットの更新に失敗しました' });
  }
});

// Delete issue
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.issue.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'チケットを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'チケットの削除に失敗しました' });
  }
});

// Add comment
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.issueComment.create({
      data: {
        issueId: Number(req.params.id),
        userId: req.userId!,
        content: req.body.content,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: 'コメントの追加に失敗しました' });
  }
});

// Update comment
router.put('/:id/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const existing = await prisma.issueComment.findUnique({ where: { id: commentId } });
    if (!existing) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }
    if (existing.userId !== req.userId) {
      res.status(403).json({ error: '他のユーザーのコメントは編集できません' });
      return;
    }
    const comment = await prisma.issueComment.update({
      where: { id: commentId },
      data: { content: req.body.content },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: 'コメントの更新に失敗しました' });
  }
});

// Delete comment
router.delete('/:id/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const existing = await prisma.issueComment.findUnique({ where: { id: commentId } });
    if (!existing) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }
    if (existing.userId !== req.userId) {
      res.status(403).json({ error: '他のユーザーのコメントは削除できません' });
      return;
    }
    await prisma.issueComment.delete({ where: { id: commentId } });
    res.json({ message: 'コメントを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'コメントの削除に失敗しました' });
  }
});

export default router;
