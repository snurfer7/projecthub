import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { assertFieldPermissions, assertDatetimeFieldPermissions } from '../services/permissions';
import { parseNumericQueryIds } from '../utils/queryParams';
import { applyAssigneeOrFilter } from '../utils/issueAssigneeFilter';
import {
  applyAggregatedParentFields,
  issueHasChildren,
  validateIssueParentId,
} from '../utils/issueParent';
import {
  getAccessibleProjectIds,
  getProjectIdForIssue,
  isRequestAdmin,
  sendProjectAccessDenied,
} from '../services/projectAccess';
import {
  getProjectIdsWithPermission,
  hasProjectPermission,
  PROJECT_PERMISSION_DENIED_MESSAGE,
  resolveProjectPermissions,
} from '../services/projectPermissions';
import {
  assertAssignableStatus,
  assertStatusTransition,
  resolveIssueWorkflow,
} from '../services/issueWorkflow';
import { estimatedHoursError, normalizeEstimatedHours } from '../utils/estimatedHours';
import {
  issueAssigneesInclude,
  parseAssignedToIdsFromBody,
  shapeIssueAssignees,
  syncIssueAssignees,
  validateAssignableUserIds,
} from '../utils/issueAssignees';

const router = Router();
const prisma = new PrismaClient();

const parentSelect = { id: true, subject: true };
const childSelect = { id: true, subject: true, startDate: true, endDate: true, dueDate: true, parentId: true, statusId: true };

async function loadParentAggregations(projectIds: number[]) {
  if (projectIds.length === 0) {
    return new Map<number, { startDate: Date | null; endDate: Date | null; statusId: number | null; status: { id: number; name: string; isClosed: boolean; position: number } | null }>();
  }
  const [rows, statuses] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, parentId: true, startDate: true, endDate: true, dueDate: true, statusId: true },
    }),
    prisma.issueStatus.findMany({ select: { id: true, name: true, isClosed: true, position: true } }),
  ]);
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const positionById = new Map(statuses.map((s) => [s.id, s.position]));
  const aggregated = applyAggregatedParentFields(rows, positionById);
  return new Map(
    aggregated.map((r) => [
      r.id,
      {
        startDate: (r.startDate as Date | null) ?? null,
        endDate: (r.endDate as Date | null) ?? null,
        statusId: r.statusId ?? null,
        status: r.statusId != null ? statusById.get(r.statusId) ?? null : null,
      },
    ])
  );
}

router.use(authenticateToken);

// List issues (with filters)
router.get('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, statusId, statusIds, trackerId, trackerIds, priorityId, assignedToId, assignedToIds, assignedToGroupId, assignedToGroupIds } = req.query;
    const accessibleIds = await getAccessibleProjectIds(req.userId!, isRequestAdmin(req));
    const permittedIds = await getProjectIdsWithPermission(req.userId!, accessibleIds, 'projects.issues', 'use');
    const where: any = {};

    if (projectId && !isNaN(Number(projectId))) {
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

    const filterStatusIds = parseNumericQueryIds(statusIds ?? statusId);
    if (filterStatusIds.length > 0) where.statusId = { in: filterStatusIds };
    const filterTrackerIds = parseNumericQueryIds(trackerIds ?? trackerId);
    if (filterTrackerIds.length > 0) where.trackerId = { in: filterTrackerIds };
    if (priorityId && String(priorityId).trim() !== '' && !isNaN(Number(priorityId))) where.priorityId = Number(priorityId);
    applyAssigneeOrFilter(where, { assignedToId, assignedToIds, assignedToGroupId, assignedToGroupIds });

    if (permittedIds.length === 0) {
      res.json([]);
      return;
    }

    const issues = await prisma.issue.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        ...issueAssigneesInclude,
        assignedToGroup: { select: { id: true, name: true } },
        parent: { select: parentSelect },
        relationsFrom: true,
        relationsTo: true,
        _count: { select: { children: true, comments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 同一プロジェクト内の全チケットで親子集約（フィルタで子が落ちても親の期間・ステータスを正しく出す）
    const projectIds = [...new Set(issues.map((i) => i.projectId))];
    const aggById = await loadParentAggregations(projectIds);

    res.json(
      issues.map((issue) => {
        const shaped = shapeIssueAssignees(issue);
        if ((issue._count?.children ?? 0) === 0) return shaped;
        const agg = aggById.get(issue.id);
        if (!agg) return shaped;
        return {
          ...shaped,
          startDate: agg.startDate,
          endDate: agg.endDate,
          statusId: agg.statusId ?? issue.statusId,
          status: agg.status ?? issue.status,
        };
      })
    );
  } catch (e) {
    console.error('Issue list error:', e);
    res.status(500).json({ error: 'チケットの取得に失敗しました' });
  }
});

// Reorder issues
router.put('/reorder', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { issues } = req.body; // Array of { id: number, position: number }
    if (!Array.isArray(issues)) {
      return res.status(400).json({ error: '不正なデータ形式です' });
    }

    const issueIds = issues.map((issue: any) => Number(issue.id)).filter((id: number) => !isNaN(id));
    const existing = await prisma.issue.findMany({
      where: { id: { in: issueIds } },
      select: { id: true, projectId: true },
    });
    const accessibleIds = await getAccessibleProjectIds(req.userId!, isRequestAdmin(req));
    const projectIds = [...new Set(existing.map((i) => i.projectId))];
    const permittedIds = new Set(
      await getProjectIdsWithPermission(req.userId!, projectIds.filter((id) => accessibleIds.includes(id)), 'projects.issues', 'input')
    );
    if (existing.some((i) => !permittedIds.has(i.projectId))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
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
router.get('/meta/options', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    const [trackers, statuses, priorities] = await Promise.all([
      prisma.tracker.findMany({ orderBy: { position: 'asc' } as any }),
      prisma.issueStatus.findMany({ orderBy: { position: 'asc' } }),
      prisma.issuePriority.findMany({ orderBy: { position: 'asc' } }),
    ]);

    let users: { id: number; firstName: string; lastName: string }[] = [];
    let groups: {
      id: number;
      name: string;
      position: number;
      members: { userId: number }[];
      parents: { id: number; name: string }[];
      children: { id: number; name: string }[];
    }[] = [];
    let workflow: Awaited<ReturnType<typeof resolveIssueWorkflow>> | undefined;

    const groupHierarchyInclude = {
      members: { select: { userId: true } },
      parentLinks: {
        include: { parentGroup: { select: { id: true, name: true } } },
        orderBy: { parentGroup: { name: 'asc' as const } },
      },
      childLinks: {
        include: { childGroup: { select: { id: true, name: true } } },
        orderBy: { position: 'asc' as const },
      },
    };

    const shapeMetaGroup = (g: {
      id: number;
      name: string;
      position: number;
      members: { userId: number }[];
      parentLinks: { parentGroup: { id: number; name: string } }[];
      childLinks: { childGroup: { id: number; name: string } }[];
    }) => ({
      id: g.id,
      name: g.name,
      position: g.position,
      members: g.members,
      parents: g.parentLinks.map((l) => l.parentGroup),
      children: g.childLinks.map((l) => l.childGroup),
    });

    if (projectId) {
      const pid = Number(projectId);
      if (!(await hasProjectPermission(req.userId!, pid, 'projects.issues', 'use'))) {
        res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
        return;
      }
      // Get explicit members and users who are in groups assigned to this project
      const [projectMembers, projectGroups, resolvedWorkflow] = await Promise.all([
        prisma.projectMember.findMany({
          where: { projectId: pid },
          include: { user: { select: { id: true, firstName: true, lastName: true, status: true } } }
        }),
        prisma.projectGroup.findMany({
          where: { projectId: pid },
          include: {
            group: { include: groupHierarchyInclude },
          },
        }),
        resolveIssueWorkflow(req.userId!, pid),
      ]);

      const userMap = new Map();
      for (const m of projectMembers) {
        userMap.set(m.user.id, m.user);
      }
      users = Array.from(userMap.values());
      const shaped = projectGroups.map((pg) => shapeMetaGroup(pg.group));
      const idSet = new Set(shaped.map((g) => g.id));
      groups = shaped.map((g) => ({
        ...g,
        parents: g.parents.filter((p) => idSet.has(p.id)),
        children: g.children.filter((c) => idSet.has(c.id)),
      }));
      workflow = resolvedWorkflow;
    } else {
      const [allUsers, allGroups] = await Promise.all([
        prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, status: true } }),
        prisma.group.findMany({
          include: groupHierarchyInclude,
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        }),
      ]);
      users = allUsers;
      groups = allGroups.map(shapeMetaGroup);
    }

    res.json({ trackers, statuses, priorities, users, groups, ...(workflow ? { workflow } : {}) });
  } catch (e) {
    console.error('メタデータ取得エラー:', e);
    res.status(500).json({ error: 'メタデータの取得に失敗しました' });
  }
});

// Get issue
router.get('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        project: { select: { id: true, name: true } },
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        ...issueAssigneesInclude,
        assignedToGroup: { select: { id: true, name: true } },
        parent: { select: parentSelect },
        children: { select: childSelect, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        comments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            attachments: true,
          },
          orderBy: { createdAt: 'asc' },
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
        _count: { select: { children: true, comments: true } },
      },
    });
    if (!issue) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }

    if (!(await hasProjectPermission(req.userId!, issue.projectId, 'projects.issues', 'use'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }

    const shaped = shapeIssueAssignees(issue);
    if (issue.children.length > 0) {
      const aggById = await loadParentAggregations([issue.projectId]);
      const agg = aggById.get(issue.id);
      if (agg) {
        res.json({
          ...shaped,
          startDate: agg.startDate,
          endDate: agg.endDate,
          statusId: agg.statusId ?? issue.statusId,
          status: agg.status ?? issue.status,
        });
        return;
      }
    }
    res.json(shaped);
  } catch (e) {
    res.status(500).json({ error: 'チケットの取得に失敗しました' });
  }
});

// Add relation
router.post('/:id/relations', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { issueToId, relationType } = req.body;
    const issueFromId = Number(req.params.id);

    const projectId = await getProjectIdForIssue(issueFromId);
    if (projectId == null) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, projectId, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }

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
router.delete('/relations/:relationId', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const relationId = Number(req.params.relationId);
    const relation = await prisma.issueRelation.findUnique({
      where: { id: relationId },
      select: { issueFromId: true },
    });
    if (!relation) {
      res.status(404).json({ error: '関連付けが見つかりません' });
      return;
    }
    const projectId = await getProjectIdForIssue(relation.issueFromId);
    if (projectId == null) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, projectId, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }

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
router.post('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, trackerId, statusId, priorityId, assignedToGroupId, subject, description, startDate, endDate, dueDate, estimatedHours, parentId } = req.body;
    const pid = Number(projectId);
    if (!(await hasProjectPermission(req.userId!, pid, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
    const permissions = await resolveProjectPermissions(req.userId!, pid);
    const deniedDt = assertDatetimeFieldPermissions(permissions, req.body, {});
    if (deniedDt) {
      res.status(403).json({ error: `フィールドの編集権限がありません: ${deniedDt}` });
      return;
    }
    const assignedToIds = parseAssignedToIdsFromBody(req.body);
    const deniedParent = assertFieldPermissions(
      permissions,
      req.body,
      {
        parentId: 'projects.issues.fields.parent',
        assignedToIds: 'projects.issues.fields.assignee',
        assignedToId: 'projects.issues.fields.assignee',
        assignedToGroupId: 'projects.issues.fields.assignee',
      },
      {}
    );
    if (deniedParent) {
      res.status(403).json({ error: `フィールドの編集権限がありません: ${deniedParent}` });
      return;
    }
    const estimatedErr = estimatedHoursError(estimatedHours);
    if (estimatedErr) {
      return res.status(400).json({ error: estimatedErr });
    }

    const nextAssigneeIds = assignedToIds ?? [];
    const assigneeError = await validateAssignableUserIds(prisma, nextAssigneeIds);
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError });
    }

    const parentError = await validateIssueParentId(prisma, {
      parentId: parentId === undefined || parentId === null || parentId === '' ? null : Number(parentId),
      projectId: pid,
    });
    if (parentError) {
      return res.status(400).json({ error: parentError });
    }

    if (statusId !== undefined && statusId !== null) {
      const workflow = await resolveIssueWorkflow(req.userId!, pid);
      const statusError = assertAssignableStatus(workflow, Number(statusId));
      if (statusError) {
        return res.status(400).json({ error: statusError });
      }
    }

    const issue = await prisma.issue.create({
      data: {
        projectId: pid,
        trackerId,
        statusId,
        priorityId,
        authorId: req.userId!,
        assignedToGroupId: assignedToGroupId || null,
        parentId: parentId ? Number(parentId) : null,
        subject,
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours: normalizeEstimatedHours(estimatedHours),
        ...(nextAssigneeIds.length > 0
          ? { assignees: { create: nextAssigneeIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: {
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        ...issueAssigneesInclude,
        assignedToGroup: { select: { id: true, name: true } },
        parent: { select: parentSelect },
      },
    });
    res.status(201).json(shapeIssueAssignees(issue));
  } catch (e) {
    console.error('POST /issues:', e);
    res.status(500).json({ error: 'チケットの作成に失敗しました' });
  }
});

// Update issue
router.put('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const issueId = Number(req.params.id);
    const existingIssue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        projectId: true,
        subject: true,
        trackerId: true,
        statusId: true,
        priorityId: true,
        assignedToGroupId: true,
        description: true,
        startDate: true,
        endDate: true,
        dueDate: true,
        estimatedHours: true,
        doneRatio: true,
        parentId: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!existingIssue) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, existingIssue.projectId, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
    const permissions = await resolveProjectPermissions(req.userId!, existingIssue.projectId);
    const hasChildren = await issueHasChildren(prisma, issueId);
    if (hasChildren && (req.body.startDate !== undefined || req.body.endDate !== undefined)) {
      res.status(400).json({ error: '子チケットがあるため開始・終了日時は変更できません' });
      return;
    }
    if (hasChildren && req.body.statusId !== undefined) {
      res.status(400).json({ error: '子チケットがあるためステータスは変更できません' });
      return;
    }
    const deniedDt = assertDatetimeFieldPermissions(permissions, req.body, existingIssue);
    if (deniedDt) {
      res.status(403).json({ error: `フィールドの編集権限がありません: ${deniedDt}` });
      return;
    }
    const existingAssigneeIds = existingIssue.assignees.map((a) => a.userId);
    const denied = assertFieldPermissions(
      permissions,
      req.body,
      {
        subject: 'projects.issues.fields.subject',
        trackerId: 'projects.issues.fields.tracker',
        statusId: 'projects.issues.fields.status',
        priorityId: 'projects.issues.fields.priority',
        assignedToIds: 'projects.issues.fields.assignee',
        assignedToId: 'projects.issues.fields.assignee',
        assignedToGroupId: 'projects.issues.fields.assignee',
        description: 'projects.issues.fields.description',
        estimatedHours: 'projects.issues.fields.estimatedHours',
        dueDate: 'projects.issues.fields.dueDate',
        doneRatio: 'projects.issues.fields.doneRatio',
        parentId: 'projects.issues.fields.parent',
      },
      { ...existingIssue, assignedToIds: existingAssigneeIds } as Record<string, unknown>
    );
    if (denied) {
      res.status(403).json({ error: `フィールドの編集権限がありません: ${denied}` });
      return;
    }
    const { trackerId, statusId, priorityId, assignedToGroupId, subject, description, startDate, endDate, dueDate, estimatedHours, doneRatio, parentId } = req.body;
    const data: any = {};
    const estimatedErr = estimatedHoursError(estimatedHours);
    if (estimatedErr) {
      return res.status(400).json({ error: estimatedErr });
    }

    if (trackerId !== undefined) data.trackerId = trackerId;
    if (statusId !== undefined) {
      const nextStatusId = Number(statusId);
      if (nextStatusId !== existingIssue.statusId) {
        const workflow = await resolveIssueWorkflow(req.userId!, existingIssue.projectId);
        const transitionError = assertStatusTransition(workflow, existingIssue.statusId, nextStatusId);
        if (transitionError) {
          return res.status(400).json({ error: transitionError });
        }
      }
      data.statusId = nextStatusId;
    }
    if (priorityId !== undefined) data.priorityId = priorityId;
    if (assignedToGroupId !== undefined) data.assignedToGroupId = assignedToGroupId || null;
    if (subject !== undefined) data.subject = subject;
    if (description !== undefined) data.description = description;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (estimatedHours !== undefined) data.estimatedHours = normalizeEstimatedHours(estimatedHours);
    if (doneRatio !== undefined) data.doneRatio = Number(doneRatio);
    if (parentId !== undefined) {
      const nextParentId = parentId === null || parentId === '' ? null : Number(parentId);
      const parentError = await validateIssueParentId(prisma, {
        parentId: nextParentId,
        projectId: existingIssue.projectId,
        issueId,
      });
      if (parentError) {
        return res.status(400).json({ error: parentError });
      }
      data.parentId = nextParentId;
    }

    const nextAssigneeIds = parseAssignedToIdsFromBody(req.body);
    if (nextAssigneeIds) {
      const assigneeError = await validateAssignableUserIds(prisma, nextAssigneeIds);
      if (assigneeError) {
        return res.status(400).json({ error: assigneeError });
      }
      await syncIssueAssignees(prisma, issueId, nextAssigneeIds);
    }

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data,
      include: {
        tracker: true,
        status: true,
        priority: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        ...issueAssigneesInclude,
        assignedToGroup: { select: { id: true, name: true } },
        parent: { select: parentSelect },
        _count: { select: { children: true } },
      },
    });

    const shaped = shapeIssueAssignees(issue);
    if ((issue._count?.children ?? 0) > 0) {
      const aggById = await loadParentAggregations([existingIssue.projectId]);
      const agg = aggById.get(issue.id);
      if (agg) {
        res.json({
          ...shaped,
          startDate: agg.startDate,
          endDate: agg.endDate,
          statusId: agg.statusId ?? issue.statusId,
          status: agg.status ?? issue.status,
        });
        return;
      }
    }
    res.json(shaped);
  } catch (e) {
    console.error('チケット更新エラー:', e);
    res.status(500).json({ error: 'チケットの更新に失敗しました' });
  }
});

// Delete issue
router.delete('/:id', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = await getProjectIdForIssue(Number(req.params.id));
    if (projectId == null) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, projectId, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }
    await prisma.issue.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'チケットを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'チケットの削除に失敗しました' });
  }
});

// Add comment
router.post('/:id/comments', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = await getProjectIdForIssue(Number(req.params.id));
    if (projectId == null) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, projectId, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
      return;
    }

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
router.put('/:id/comments/:commentId', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const existing = await prisma.issueComment.findUnique({ where: { id: commentId } });
    if (!existing) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }
    const projectId = await getProjectIdForIssue(existing.issueId);
    if (projectId == null) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, projectId, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
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
router.delete('/:id/comments/:commentId', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const existing = await prisma.issueComment.findUnique({ where: { id: commentId } });
    if (!existing) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }
    const projectId = await getProjectIdForIssue(existing.issueId);
    if (projectId == null) {
      res.status(404).json({ error: 'チケットが見つかりません' });
      return;
    }
    if (!(await hasProjectPermission(req.userId!, projectId, 'projects.issues', 'input'))) {
      res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
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
