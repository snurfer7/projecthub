import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import {
  requireProjectMember,
  projectListAccessWhere,
  isRequestAdmin,
  ensureProjectHasMember,
} from '../services/projectAccess';
import {
  requireProjectPermission,
  resolveProjectPermissions,
} from '../services/projectPermissions';
import { removeIndividualMember, removeGroupSourcedRoles } from '../services/projectMemberRoles';
import {
  expandProjectGroupMembers,
  getProjectsEffectiveMemberUserIds,
} from '../services/projectMembership';
import { scheduleNotify } from '../services/notifications';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List projects (member projects only)
router.get('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    // 一覧はクライアント側でフィルタ／ツリー表示のみを行うため、表示・絞り込みに使う
    // フィールドだけを取得する（メンバー詳細・ロール・関連会社の拠点/担当などは取得しない）。
    // これにより 1 件あたりのペイロードとネストしたリレーション読み込みを大幅に削減する。
    const accessWhere = await projectListAccessWhere(req.userId!, isRequestAdmin(req));
    const projects = await prisma.project.findMany({
      where: accessWhere,
      include: {
        company: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        relatedCompanies: {
          select: {
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
        groups: { select: { groupId: true, roleIds: true } },
        _count: { select: { issues: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    // members.userId = effective set (individual ∪ group expansion) for client-side filters
    const effectiveByProject = await getProjectsEffectiveMemberUserIds(projects.map((p) => p.id));
    res.json(
      projects.map((p) => ({
        ...p,
        members: (effectiveByProject.get(p.id) ?? []).map((userId) => ({ userId })),
      }))
    );
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの取得に失敗しました' });
  }
});

// Get project
router.get('/:id', requirePermission('projects', 'use'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        company: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        parent: { select: { id: true, name: true } },
        relatedCompanies: {
          include: {
            company: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          }
        },
        children: { select: { id: true, name: true, identifier: true, status: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            roles: { include: { role: true } },
          },
        },
        groups: {
          include: {
            group: { select: { id: true, name: true } },
          },
        },
        _count: { select: { issues: true, wikiPages: true, attachments: true, timeEntries: true, comments: true } },
      },
    });
    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つかりません' });
      return;
    }

    // Individual members only in `members`; strip legacy sourceGroup roles from payload
    const members = project.members.map((m) => ({
      ...m,
      roles: m.roles.filter((r) => r.sourceGroupId == null),
    }));

    const groups = await Promise.all(
      project.groups.map(async (pg) => ({
        ...pg,
        group: {
          ...pg.group,
          members: await expandProjectGroupMembers(pg.groupId),
        },
      }))
    );

    const myPermissions = await resolveProjectPermissions(req.userId!, projectId, {
      isAdmin: isRequestAdmin(req),
    });
    res.json({ ...project, members, groups, myPermissions });
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの取得に失敗しました' });
  }
});

// Create project
router.post('/', requirePermission('projects', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      identifier,
      description,
      companyId: companyIdRaw,
      locationId: locationIdRaw,
      contactId: contactIdRaw,
      parentId,
      dueDate,
      remarks,
      relatedCompanies,
      sourceActivityId: sourceActivityIdRaw,
    } = req.body;

    if (!name || !identifier) {
      return res.status(400).json({ error: 'プロジェクト名と識別子が必要です' });
    }

    const sourceActivityId =
      sourceActivityIdRaw != null && sourceActivityIdRaw !== ''
        ? Number(sourceActivityIdRaw)
        : null;
    if (sourceActivityId != null && (!Number.isFinite(sourceActivityId) || sourceActivityId <= 0)) {
      return res.status(400).json({ error: 'sourceActivityId が不正です' });
    }

    let sourceActivity: {
      id: number;
      companyId: number;
      description: string | null;
      locationId: number | null;
      dueDate: Date | null;
    } | null = null;
    if (sourceActivityId != null) {
      sourceActivity = await prisma.activity.findUnique({
        where: { id: sourceActivityId },
        select: { id: true, companyId: true, description: true, locationId: true, dueDate: true },
      });
      if (!sourceActivity) {
        return res.status(404).json({ error: '活動が見つかりません' });
      }
    }

    // 活動起点で description 未指定のときのみ、活動の詳細をプロジェクト説明に採用
    // （フロントが空文字・null を送った場合はユーザーが消したとみなし上書きしない）
    let projectDescription: string | null;
    if (description === undefined) {
      projectDescription = sourceActivity?.description ?? null;
    } else if (description == null || String(description).trim() === '') {
      projectDescription = null;
    } else {
      projectDescription = String(description);
    }

    let companyId: number | null = companyIdRaw ? Number(companyIdRaw) : null;
    if (companyId != null && !Number.isFinite(companyId)) {
      return res.status(400).json({ error: 'companyId が不正です' });
    }
    // 活動起点で主企業が未指定なら活動の企業を採用
    if (companyId == null && sourceActivity) {
      companyId = sourceActivity.companyId;
    }

    let locationId: number | null;
    if (locationIdRaw === undefined) {
      locationId = sourceActivity?.locationId ?? null;
    } else if (locationIdRaw === null || locationIdRaw === '') {
      locationId = null;
    } else {
      locationId = Number(locationIdRaw);
    }

    const contactId = contactIdRaw ? Number(contactIdRaw) : null;
    if ((locationId != null && !Number.isFinite(locationId)) || (contactId != null && !Number.isFinite(contactId))) {
      return res.status(400).json({ error: 'locationId または contactId が不正です' });
    }
    if ((locationId != null || contactId != null) && companyId == null) {
      return res.status(400).json({ error: '拠点・先方担当者を指定する場合は企業が必要です' });
    }
    if (companyId != null && locationId != null) {
      const loc = await prisma.location.findFirst({
        where: { id: locationId, companyId },
        select: { id: true },
      });
      if (!loc) {
        return res.status(400).json({ error: '拠点は指定された企業に属する必要があります' });
      }
    }
    if (companyId != null && contactId != null) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, companyId },
        select: { id: true },
      });
      if (!contact) {
        return res.status(400).json({ error: '先方担当者は指定された企業に属する必要があります' });
      }
    }

    let projectDueDate: Date | null;
    if (dueDate === undefined) {
      projectDueDate = sourceActivity?.dueDate ?? null;
    } else if (dueDate === null || dueDate === '') {
      projectDueDate = null;
    } else {
      projectDueDate = new Date(dueDate);
    }

    const relatedCompanyIds = (relatedCompanies || []).map((rc: any) => Number(rc.companyId)).filter((id: number) => Number.isFinite(id) && id > 0);

    if (sourceActivity) {
      const allowed = new Set<number>();
      if (companyId != null) allowed.add(companyId);
      for (const id of relatedCompanyIds) allowed.add(id);
      if (!allowed.has(sourceActivity.companyId)) {
        return res.status(400).json({
          error: '活動の企業は作成するプロジェクトの主企業または関連企業である必要があります',
        });
      }
    }

    // Creator gets every Role (same as ensureProjectHasMember fallback)
    const allRoles = await prisma.role.findMany({ select: { id: true } });
    if (allRoles.length === 0) return res.status(500).json({ error: 'ロールが見つかりません' });

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          identifier,
          description: projectDescription,
          companyId,
          locationId,
          contactId,
          parentId: parentId ? Number(parentId) : null,
          dueDate: projectDueDate,
          remarks,
          relatedCompanies: {
            create: (relatedCompanies || []).map((rc: any) => ({
              companyId: Number(rc.companyId),
              locationId: rc.locationId ? Number(rc.locationId) : null,
              contactId: rc.contactId ? Number(rc.contactId) : null,
              remarks: rc.remarks,
            })),
          },
          members: {
            create: {
              userId: req.userId!,
              roles: {
                create: allRoles.map((r) => ({ roleId: r.id, sourceGroupId: null })),
              },
            },
          },
        },
      });

      if (sourceActivity) {
        await tx.activityProject.create({
          data: { activityId: sourceActivity.id, projectId: created.id },
        });
      }

      return created;
    });

    scheduleNotify({ type: 'project.created', actorUserId: req.userId!, projectId: project.id });
    if (sourceActivity) {
      scheduleNotify({
        type: 'project.activity_linked',
        actorUserId: req.userId!,
        projectId: project.id,
        activityId: sourceActivity.id,
      });
    }

    res.status(201).json(project);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'この識別子は既に使用されています。再生成してください。' });
    }
    res.status(500).json({ error: 'プロジェクトの作成に失敗しました', details: e.message });
  }
});

// Update project
router.put('/:id', requirePermission('projects', 'use'), requireProjectPermission('projects.overview', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const existing = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true, dueDate: true },
    });
    const { name, description, status, companyId, locationId, contactId, parentId, dueDate, remarks, relatedCompanies } = req.body;
    const data: any = { name, description, status, remarks };
    if (companyId !== undefined) data.companyId = companyId ? Number(companyId) : null;
    if (locationId !== undefined) data.locationId = locationId ? Number(locationId) : null;
    if (contactId !== undefined) data.contactId = contactId ? Number(contactId) : null;
    if (parentId !== undefined) data.parentId = parentId ? Number(parentId) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

    if (relatedCompanies !== undefined) {
      data.relatedCompanies = {
        deleteMany: {},
        create: (relatedCompanies || []).map((rc: any) => ({
          companyId: Number(rc.companyId),
          locationId: rc.locationId ? Number(rc.locationId) : null,
          contactId: rc.contactId ? Number(rc.contactId) : null,
          remarks: rc.remarks
        }))
      };
    }
    const project = await prisma.project.update({
      where: { id: Number(req.params.id) },
      data,
    });
    if (existing) {
      if (status !== undefined && status !== existing.status) {
        scheduleNotify({
          type: 'project.status_changed',
          actorUserId: req.userId!,
          projectId: project.id,
        });
      }
      if (dueDate !== undefined) {
        const nextMs = dueDate ? new Date(dueDate).getTime() : null;
        const prevMs = existing.dueDate ? existing.dueDate.getTime() : null;
        if (nextMs !== prevMs) {
          scheduleNotify({
            type: 'project.due_date_changed',
            actorUserId: req.userId!,
            projectId: project.id,
          });
        }
      }
    }
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの更新に失敗しました' });
  }
});

// Delete project
router.delete('/:id', requirePermission('projects', 'use'), requireProjectPermission('projects.overview', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.project.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'プロジェクトを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの削除に失敗しました' });
  }
});

// Add individual member with multiple roles
router.post('/:id/members', requirePermission('projects', 'use'), requireProjectPermission('projects.members', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { userId, roleIds } = req.body;

    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      res.status(400).json({ error: 'ロールを指定してください' });
      return;
    }

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
      if (user && (user.status === 'pending' || user.status === 'inactive')) {
        return res.status(400).json({ error: '選択されたユーザー（仮登録または無効）はプロジェクトメンバーに指定できません' });
      }
    }

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: Number(userId) } }
    });

    if (member) {
      await prisma.$transaction(async (tx: any) => {
        const existingRoles = await tx.projectMemberRole.findMany({
          where: { projectMemberId: member.id, sourceGroupId: null },
          select: { roleId: true }
        });
        const existingRoleIds = new Set(existingRoles.map((r: any) => r.roleId));

        for (const rId of roleIds) {
          const numericRoleId = Number(rId);
          if (!existingRoleIds.has(numericRoleId)) {
            await tx.projectMemberRole.create({
              data: {
                projectMemberId: member.id,
                roleId: numericRoleId,
                sourceGroupId: null
              }
            });
          }
        }
      });

      const updated = await prisma.projectMember.findUnique({
        where: { id: member.id },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, roles: { include: { role: true } } },
      });
      res.status(200).json(updated);
      return;
    }

    const newMember = await prisma.projectMember.create({
      data: {
        projectId,
        userId: Number(userId),
        roles: {
          create: roleIds.map((id: any) => ({ roleId: Number(id), sourceGroupId: null }))
        }
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, roles: { include: { role: true } } },
    });
    scheduleNotify({
      type: 'project.member_added',
      actorUserId: req.userId!,
      projectId,
      addedUserId: Number(userId),
    });
    res.status(201).json(newMember);
  } catch (e: any) {
    console.error('Add member error:', e);
    res.status(500).json({ error: 'メンバーの追加に失敗しました', details: e.message });
  }
});

// Update individual member roles
router.put('/:id/members/:memberId', requirePermission('projects', 'use'), requireProjectPermission('projects.members', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const { roleIds } = req.body;
    const memberId = Number(req.params.memberId);
    const projectId = Number(req.params.id);

    if (!Array.isArray(roleIds)) {
      res.status(400).json({ error: 'ロールを配列で指定してください' });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      if (roleIds.length === 0) {
        await removeIndividualMember(tx, memberId);
      } else {
        await tx.projectMemberRole.deleteMany({ where: { projectMemberId: memberId } });
        await tx.projectMemberRole.createMany({
          data: roleIds.map((id: number) => ({
            projectMemberId: memberId,
            roleId: Number(id),
            sourceGroupId: null,
          })),
        });
      }

      if (req.userId) {
        await ensureProjectHasMember(tx, projectId, req.userId);
      }
    });

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, roles: { include: { role: true } } },
    });
    res.json(member || { message: 'メンバーを削除しました', deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'ロールの更新に失敗しました' });
  }
});

// Remove individual member assignment
router.delete('/:id/members/:memberId', requirePermission('projects', 'use'), requireProjectPermission('projects.members', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const memberId = Number(req.params.memberId);
    const projectId = Number(req.params.id);
    await prisma.$transaction(async (tx: any) => {
      await removeIndividualMember(tx, memberId);
      if (req.userId) {
        await ensureProjectHasMember(tx, projectId, req.userId);
      }
    });
    res.json({ message: 'メンバーを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'メンバーの削除に失敗しました' });
  }
});

// Get available roles
router.get('/roles/available', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { position: 'asc' } });
    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: 'ロール一覧の取得に失敗しました' });
  }
});

// Get groups assigned to project
router.get('/:id/groups', requirePermission('projects', 'use'), requireProjectPermission('projects.members', 'use', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectGroups = await prisma.projectGroup.findMany({
      where: { projectId: Number(req.params.id) },
      include: { group: { select: { id: true, name: true } } },
    });
    const expanded = await Promise.all(
      projectGroups.map(async (pg) => ({
        ...pg,
        group: {
          ...pg.group,
          members: await expandProjectGroupMembers(pg.groupId),
        },
      }))
    );
    res.json(expanded);
  } catch (e) {
    res.status(500).json({ error: 'グループ一覧の取得に失敗しました' });
  }
});

// Assign group to project (store groupId + roleIds only; membership expanded at read time)
router.post('/:id/groups', requirePermission('projects', 'use'), requireProjectPermission('projects.members', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { groupId, roleIds } = req.body;

    if (!groupId || !Array.isArray(roleIds) || roleIds.length === 0) {
      res.status(400).json({ error: 'groupId と roleIds は必須です' });
      return;
    }

    const numericGroupId = Number(groupId);
    const normalizedRoleIds = [...new Set(roleIds.map((id: number) => Number(id)).filter((n: number) => Number.isInteger(n) && n > 0))];
    if (normalizedRoleIds.length === 0) {
      res.status(400).json({ error: 'roleIds は必須です' });
      return;
    }

    const group = await prisma.group.findUnique({ where: { id: numericGroupId } });
    if (!group) {
      res.status(404).json({ error: 'グループが見つかりません' });
      return;
    }

    const pg = await prisma.projectGroup.create({
      data: {
        projectId,
        groupId: numericGroupId,
        roleIds: normalizedRoleIds,
      },
      include: { group: { select: { id: true, name: true } } },
    });

    res.status(201).json({
      ...pg,
      group: {
        ...pg.group,
        members: await expandProjectGroupMembers(numericGroupId),
      },
    });
    scheduleNotify({
      type: 'project.group_assigned',
      actorUserId: req.userId!,
      projectId,
      groupId: numericGroupId,
    });
  } catch (e: any) {
    console.error('Assign group error:', e);
    if (e.code === 'P2002') {
      res.status(400).json({ error: 'このグループは既に割り当てられています' });
      return;
    }
    res.status(500).json({ error: 'グループの追加に失敗しました', details: e.message });
  }
});

// Update assigned group roleIds
router.put('/:id/groups/:groupId/role', requirePermission('projects', 'use'), requireProjectPermission('projects.members', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const groupId = Number(req.params.groupId);
    const { roleIds } = req.body;

    if (!Array.isArray(roleIds)) {
      res.status(400).json({ error: 'roleIds を配列で指定してください' });
      return;
    }

    const normalizedRoleIds = [...new Set(roleIds.map((id: number) => Number(id)).filter((n: number) => Number.isInteger(n) && n > 0))];
    if (normalizedRoleIds.length === 0) {
      res.status(400).json({ error: 'ロールを1つ以上指定してください' });
      return;
    }

    const updated = await prisma.projectGroup.updateMany({
      where: { projectId, groupId },
      data: { roleIds: normalizedRoleIds },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: 'グループの割り当てが見つかりません' });
      return;
    }

    res.json({ message: 'グループのロールを更新しました', roleIds: normalizedRoleIds });
  } catch (e) {
    res.status(500).json({ error: 'グループのロール更新に失敗しました' });
  }
});

// Remove group from project
router.delete('/:id/groups/:groupId', requirePermission('projects', 'use'), requireProjectPermission('projects.members', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const groupId = Number(req.params.groupId);

    await prisma.$transaction(async (tx: any) => {
      // Clean any legacy sourceGroup roles for this assignment
      await removeGroupSourcedRoles(tx, { groupIds: [groupId], projectId });
      await tx.projectGroup.deleteMany({ where: { projectId, groupId } });
      if (req.userId) {
        await ensureProjectHasMember(tx, projectId, req.userId);
      }
    });

    res.json({ message: 'グループの割り当てを解除しました' });
  } catch (e) {
    res.status(500).json({ error: 'グループの削除に失敗しました' });
  }
});

// Get project comments
router.get('/:id/comments', requirePermission('projects', 'use'), requireProjectPermission('projects.comments', 'use', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const comments = await (prisma as any).projectComment.findMany({
      where: { projectId: Number(req.params.id) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: 'コメントの取得に失敗しました' });
  }
});

// Create project comment
router.post('/:id/comments', requirePermission('projects', 'use'), requireProjectPermission('projects.comments', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { content } = req.body;

    if (!req.userId) {
      res.status(401).json({ error: 'ユーザーが認証されていません' });
      return;
    }
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'コメント内容を入力してください' });
      return;
    }

    const comment = await (prisma as any).projectComment.create({
      data: {
        projectId,
        userId: req.userId,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    scheduleNotify({
      type: 'project.commented',
      actorUserId: req.userId!,
      projectId,
    });
    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: 'コメントの追加に失敗しました' });
  }
});

// Update project comment
router.put('/:id/comments/:commentId', requirePermission('projects', 'use'), requireProjectPermission('projects.comments', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    const { content } = req.body;

    const existing = await (prisma as any).projectComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }

    if (existing.userId !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user?.isAdmin) {
        res.status(403).json({ error: '編集権限がありません' });
        return;
      }
    }

    const comment = await (prisma as any).projectComment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: 'コメントの更新に失敗しました' });
  }
});

// Delete project comment
router.delete('/:id/comments/:commentId', requirePermission('projects', 'use'), requireProjectPermission('projects.comments', 'input', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const commentId = Number(req.params.commentId);

    const existing = await (prisma as any).projectComment.findFirst({
      where: { id: commentId, projectId },
    });

    if (!existing) {
      res.status(404).json({ error: 'コメントが見つかりません' });
      return;
    }

    if (existing.userId !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user?.isAdmin) {
        res.status(403).json({ error: '削除権限がありません' });
        return;
      }
    }

    await (prisma as any).projectComment.delete({ where: { id: commentId } });
    res.json({ message: 'コメントを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'コメントの削除に失敗しました' });
  }
});

// Get activities linked to project (N:N)
router.get('/:id/activities', requirePermission('projects', 'use'), requireProjectPermission('projects.activities', 'use', { paramName: 'id' }), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const activities = await prisma.activity.findMany({
      where: { projectLinks: { some: { projectId } } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        projectLinks: {
          include: {
            project: { select: { id: true, name: true, identifier: true } },
          },
        },
        fileComment: {
          select: {
            id: true,
            attachments: {
              select: { id: true, filename: true, contentType: true, fileSize: true },
              orderBy: { id: 'asc' as const },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      activities.map(({ projectLinks, ...rest }) => ({
        ...rest,
        projects: projectLinks.map((link) => link.project),
      })),
    );
  } catch (e) {
    res.status(500).json({ error: '活動履歴の取得に失敗しました' });
  }
});

// Link existing activity to project
router.post('/:id/activities', requirePermission('companies.activities', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const activityId = Number(req.body.activityId);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      return res.status(400).json({ error: 'activityId が必要です' });
    }

    const [project, activity] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          companyId: true,
          relatedCompanies: { select: { companyId: true } },
        },
      }),
      prisma.activity.findUnique({
        where: { id: activityId },
        select: { id: true, companyId: true },
      }),
    ]);

    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }
    if (!activity) {
      return res.status(404).json({ error: '活動が見つかりません' });
    }

    const allowed = new Set<number>();
    if (project.companyId != null) allowed.add(project.companyId);
    for (const rc of project.relatedCompanies) allowed.add(rc.companyId);
    if (!allowed.has(activity.companyId)) {
      return res.status(400).json({
        error: 'プロジェクトは指定された企業の主企業または関連企業である必要があります',
      });
    }

    await prisma.activityProject.upsert({
      where: { activityId_projectId: { activityId, projectId } },
      create: { activityId, projectId },
      update: {},
    });

    res.status(201).json({ message: '活動をプロジェクトに紐づけました', activityId, projectId });
    scheduleNotify({
      type: 'project.activity_linked',
      actorUserId: req.userId!,
      projectId,
      activityId,
    });
  } catch (e) {
    console.error('Project activity link error:', e);
    res.status(500).json({ error: '活動の紐づけに失敗しました' });
  }
});

// Unlink activity from project
router.delete('/:id/activities/:activityId', requirePermission('companies.activities', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const activityId = Number(req.params.activityId);
    await prisma.activityProject.deleteMany({
      where: { projectId, activityId },
    });
    res.json({ message: '活動の紐づけを解除しました' });
  } catch (e) {
    console.error('Project activity unlink error:', e);
    res.status(500).json({ error: '活動の紐づけ解除に失敗しました' });
  }
});

export default router;
