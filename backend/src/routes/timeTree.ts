import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { parseNumericQueryIds } from '../utils/queryParams';
import { applyAssigneeOrFilter } from '../utils/issueAssigneeFilter';
import { issueAssigneesInclude, shapeIssueAssignees } from '../utils/issueAssignees';
import { getAccessibleProjectIds, isRequestAdmin } from '../services/projectAccess';
import {
  getListableProjectIds,
  resolveProjectPermissionsBatch,
} from '../services/projectPermissions';
import { resolveIssueWorkflowsBatch } from '../services/issueWorkflow';

const router = Router();
const prisma = new PrismaClient();

const timeTreeIssueInclude = {
  tracker: { select: { id: true, name: true, position: true } },
  status: { select: { id: true, name: true, isClosed: true, position: true } },
  priority: { select: { id: true, name: true, position: true } },
  ...issueAssigneesInclude,
  assignedToGroup: { select: { id: true, name: true } },
  _count: { select: { children: true } },
} as const;

router.use(authenticateToken);

/**
 * Lightweight payload for the project-list Time tab.
 * Query `include=entries` returns only timeEntries (skip issues / meta / permissions / workflows).
 */
router.get('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      trackerId,
      trackerIds,
      statusId,
      statusIds,
      assignedToId,
      assignedToIds,
      assignedToGroupId,
      assignedToGroupIds,
      userId,
      userIds,
      userGroupIds,
      startDate,
      endDate,
      include,
    } = req.query;

    const entriesOnly = String(include || 'all') === 'entries';
    const admin = isRequestAdmin(req);
    const accessibleIds = await getAccessibleProjectIds(req.userId!, admin);

    const timeProjectIds = await getListableProjectIds(
      req.userId!,
      accessibleIds,
      'projects.time-entries',
      admin
    );

    const recordUserIds = new Set(parseNumericQueryIds(userIds ?? userId));
    const recordGroupIds = parseNumericQueryIds(userGroupIds);
    if (recordGroupIds.length > 0) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: { in: recordGroupIds } },
        select: { userId: true },
      });
      for (const m of members) recordUserIds.add(m.userId);
    }

    const hasRecordUserFilter =
      parseNumericQueryIds(userIds ?? userId).length > 0 || recordGroupIds.length > 0;
    if (hasRecordUserFilter && recordUserIds.size === 0) {
      if (entriesOnly) {
        res.json({ timeEntries: [] });
        return;
      }
      // Still return issues / meta so the tree can show tickets without entries
    }

    const entryWhere: Record<string, unknown> = {
      projectId: { in: timeProjectIds },
    };
    if (hasRecordUserFilter && recordUserIds.size > 0) {
      entryWhere.userId = { in: [...recordUserIds] };
    }
    if (startDate || endDate) {
      const spentOn: { gte?: Date; lte?: Date } = {};
      if (startDate) spentOn.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        spentOn.lte = end;
      }
      entryWhere.spentOn = spentOn;
    }

    const loadEntries =
      timeProjectIds.length === 0 || (hasRecordUserFilter && recordUserIds.size === 0)
        ? Promise.resolve([])
        : prisma.timeEntry.findMany({
            where: entryWhere,
            select: {
              id: true,
              projectId: true,
              issueId: true,
              userId: true,
              hours: true,
              activity: true,
              spentOn: true,
              comments: true,
              createdAt: true,
              user: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { spentOn: 'desc' },
          });

    if (entriesOnly) {
      const timeEntries = await loadEntries;
      res.json({ timeEntries });
      return;
    }

    const issueProjectIds = await getListableProjectIds(
      req.userId!,
      accessibleIds,
      'projects.issues',
      admin
    );

    const issueWhere: Record<string, unknown> = {
      projectId: { in: issueProjectIds },
    };
    const filterStatusIds = parseNumericQueryIds(statusIds ?? statusId);
    if (filterStatusIds.length > 0) issueWhere.statusId = { in: filterStatusIds };
    const filterTrackerIds = parseNumericQueryIds(trackerIds ?? trackerId);
    if (filterTrackerIds.length > 0) issueWhere.trackerId = { in: filterTrackerIds };
    applyAssigneeOrFilter(issueWhere, {
      assignedToId,
      assignedToIds,
      assignedToGroupId,
      assignedToGroupIds,
    });

    const loadIssues =
      issueProjectIds.length === 0
        ? Promise.resolve([])
        : prisma.issue.findMany({
            where: issueWhere,
            include: timeTreeIssueInclude,
            orderBy: { updatedAt: 'desc' },
          });

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

    const [issuesRaw, timeEntries, statuses, groupsRaw] = await Promise.all([
      loadIssues,
      loadEntries,
      prisma.issueStatus.findMany({ orderBy: { position: 'asc' } }),
      prisma.group.findMany({
        include: groupHierarchyInclude,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const issues = issuesRaw.map((issue) => shapeIssueAssignees(issue));
    const groups = groupsRaw.map((g) => ({
      id: g.id,
      name: g.name,
      position: g.position,
      members: g.members,
      parents: g.parentLinks.map((l) => l.parentGroup),
      children: g.childLinks.map((l) => l.childGroup),
    }));

    const projectIdsForPerms = [
      ...new Set([
        ...issues.map((i) => i.projectId),
        ...timeEntries.map((e) => e.projectId),
      ]),
    ];

    const [permissionsByProjectId, workflowByProjectId] = await Promise.all([
      resolveProjectPermissionsBatch(req.userId!, projectIdsForPerms, { isAdmin: admin }),
      resolveIssueWorkflowsBatch(req.userId!, projectIdsForPerms),
    ]);

    res.json({
      issues,
      timeEntries,
      statuses,
      groups,
      permissionsByProjectId,
      workflowByProjectId,
    });
  } catch (e) {
    console.error('Time tree error:', e);
    res.status(500).json({ error: '時間タブデータの取得に失敗しました' });
  }
});

export default router;
