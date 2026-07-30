import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { parseNumericQueryIds } from '../utils/queryParams';
import { applyAggregatedParentFields } from '../utils/issueParent';
import { getAccessibleProjectIds, isRequestAdmin } from '../services/projectAccess';
import {
  getProjectIdsWithPermission,
  requireProjectPermission,
} from '../services/projectPermissions';

const router = Router();
const prisma = new PrismaClient();

const issueInclude = {
  project: { select: { id: true, name: true } },
  tracker: true,
  status: true,
  priority: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  relationsFrom: true,
  _count: { select: { comments: true, children: true } },
} as const;

async function loadGanttIssues(where: Record<string, unknown>) {
  const issues = await prisma.issue.findMany({
    where,
    include: issueInclude,
    orderBy: [{ projectId: 'asc' }, { position: 'asc' }, { startDate: 'asc' }],
  });

  if (issues.length === 0) return issues;

  // 祖先を補完（フィルタで子だけ残っても親バーを表示）
  const byId = new Map(issues.map((i) => [i.id, i]));
  let missingParentIds = [
    ...new Set(
      issues
        .map((i) => i.parentId)
        .filter((id): id is number => id != null && !byId.has(id))
    ),
  ];
  while (missingParentIds.length > 0) {
    const parents = await prisma.issue.findMany({
      where: { id: { in: missingParentIds } },
      include: issueInclude,
    });
    missingParentIds = [];
    for (const parent of parents) {
      if (byId.has(parent.id)) continue;
      byId.set(parent.id, parent);
      if (parent.parentId != null && !byId.has(parent.parentId)) {
        missingParentIds.push(parent.parentId);
      }
    }
  }

  // 同一プロジェクトの階層全体で集約するため、不足している兄弟・子孫も取得
  const projectIds = [...new Set([...byId.values()].map((i) => i.projectId))];
  const [hierarchyRows, statuses] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, parentId: true, startDate: true, endDate: true, dueDate: true, statusId: true, projectId: true },
    }),
    prisma.issueStatus.findMany({ select: { id: true, name: true, isClosed: true, position: true } }),
  ]);
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const positionById = new Map(statuses.map((s) => [s.id, s.position]));
  const aggregated = applyAggregatedParentFields(hierarchyRows, positionById);
  const aggById = new Map(
    aggregated.map((r) => [
      r.id,
      {
        startDate: r.startDate as Date | null,
        endDate: r.endDate as Date | null,
        statusId: r.statusId ?? null,
        status: r.statusId != null ? statusById.get(r.statusId) ?? null : null,
      },
    ])
  );

  // 表示対象: 元の issues + 祖先（日付未設定の親も含め階層を保つ）
  const resultIds = new Set(issues.map((i) => i.id));
  for (const issue of byId.values()) {
    if (!resultIds.has(issue.id)) resultIds.add(issue.id);
  }

  return [...resultIds]
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .map((issue) => {
      const childCount = issue._count?.children ?? 0;
      if (childCount === 0) return issue;
      const agg = aggById.get(issue.id);
      if (!agg) return issue;
      return {
        ...issue,
        startDate: agg.startDate,
        endDate: agg.endDate,
        statusId: agg.statusId ?? issue.statusId,
        status: agg.status ?? issue.status,
      };
    })
    .sort((a, b) => {
      if (a.projectId !== b.projectId) return a.projectId - b.projectId;
      if (a.position !== b.position) return a.position - b.position;
      const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
      return aStart - bStart;
    });
}

router.use(authenticateToken);

// Get gantt data for project
router.get(
  '/project/:projectId',
  requirePermission('projects', 'use'),
  requireProjectPermission('projects.gantt', 'use', { paramName: 'projectId' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const { trackerId, trackerIds, assignedToId, assignedToIds, statusId, statusIds } = req.query;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, dueDate: true, parentId: true },
      });

      if (!project) {
        return res.status(404).json({ error: 'プロジェクトが見つかりません' });
      }

      const where: any = {
        projectId: projectId,
      };
      const filterTrackerIds = parseNumericQueryIds(trackerIds ?? trackerId);
      if (filterTrackerIds.length > 0) where.trackerId = { in: filterTrackerIds };
      const assigneeIds = parseNumericQueryIds(assignedToIds ?? assignedToId);
      if (assigneeIds.length > 0) where.assignedToId = { in: assigneeIds };
      const filterStatusIds = parseNumericQueryIds(statusIds ?? statusId);
      if (filterStatusIds.length > 0) where.statusId = { in: filterStatusIds };

      const issues = await loadGanttIssues(where);
      res.json({ project, issues });
    } catch (e) {
      console.error('Gantt project error:', e);
      res.status(500).json({ error: 'ガントチャートデータの取得に失敗しました' });
    }
  }
);

// Get gantt data for all projects
router.get('/all', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const { trackerId, trackerIds, assignedToId, assignedToIds, statusId, statusIds } = req.query;

    const accessibleIds = await getAccessibleProjectIds(req.userId!, isRequestAdmin(req));
    const permittedIds = await getProjectIdsWithPermission(req.userId!, accessibleIds, 'projects.gantt', 'use');

    const projects = permittedIds.length === 0
      ? []
      : await prisma.project.findMany({
          where: {
            status: 'active',
            id: { in: permittedIds },
          },
          select: {
            id: true,
            name: true,
            dueDate: true,
            parentId: true,
            companyId: true,
            company: { select: { id: true, name: true } },
            relatedCompanies: {
              select: { companyId: true },
            },
          },
          orderBy: { name: 'asc' },
        });

    // 有効プロジェクト配下のみ（日付未設定チケットも含む）
    const where: any = {
      projectId: { in: projects.map((p) => p.id) },
    };
    const filterTrackerIds = parseNumericQueryIds(trackerIds ?? trackerId);
    if (filterTrackerIds.length > 0) where.trackerId = { in: filterTrackerIds };
    const assigneeIds = parseNumericQueryIds(assignedToIds ?? assignedToId);
    if (assigneeIds.length > 0) where.assignedToId = { in: assigneeIds };
    const filterStatusIds = parseNumericQueryIds(statusIds ?? statusId);
    if (filterStatusIds.length > 0) where.statusId = { in: filterStatusIds };

    const issues = projects.length === 0 ? [] : await loadGanttIssues(where);
    res.json({ projects, issues });
  } catch (e) {
    console.error('Gantt all error:', e);
    res.status(500).json({ error: 'ガントチャートデータの取得に失敗しました' });
  }
});

export default router;
