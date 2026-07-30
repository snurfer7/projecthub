import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/permissions';
import permissionSetRoutes from './permissionSets';
import { sendTemporaryPasswordEmail, sendTestEmail } from '../services/email';
import { encryptSecret } from '../services/emailCrypto';
import {
  getOrCreateSystemSetting,
  holidaySettingsDto,
  parseHolidayDateEntries,
  parseHolidayWeekdays,
} from '../services/systemCalendar';
import { clearProjectPermissionCache } from '../services/projectPermissions';

const router = Router();
const prisma = new PrismaClient();

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^*';

function generateTemporaryPassword(length = 12): string {
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += TEMP_PASSWORD_CHARS[randomInt(0, TEMP_PASSWORD_CHARS.length)];
  }
  return password;
}

router.use(authenticateToken);
router.use(permissionSetRoutes);

// Users
router.get('/users', requireAnyPermission(['admin.users', 'projects', 'companies.deals', 'admin.groups', 'admin.permission-sets'], 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, status: true, isAdmin: true, createdAt: true,
        groupMembers: { select: { group: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'ユーザーの取得に失敗しました' });
  }
});

router.post('/users', requirePermission('admin.users', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, firstName, lastName, isAdmin, groupIds } = req.body;
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const userRole = isAdmin ? 'admin' : 'member';
    const user = await prisma.user.create({
      data: {
        email, passwordHash, firstName, lastName, role: userRole, isAdmin: !!isAdmin,
        status: 'pending',
        groupMembers: {
          create: (groupIds || []).map((groupId: number) => ({ groupId })),
        },
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, status: true, isAdmin: true,
        groupMembers: { select: { group: { select: { id: true, name: true } } } },
      },
    });

    try {
      await sendTemporaryPasswordEmail(email, firstName, lastName, temporaryPassword);
    } catch (emailErr) {
      console.error('Failed to send temporary password email:', emailErr);
      // Create was successful, so we do not block returning a 201
    }

    res.status(201).json(user);
  } catch (e) {
    res.status(500).json({ error: 'ユーザーの作成に失敗しました' });
  }
});

router.put('/users/:id', requirePermission('admin.users', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, firstName, lastName, isAdmin, status, password, groupIds } = req.body;
    const userId = Number(req.params.id);
    const userRole = isAdmin !== undefined ? (isAdmin ? 'admin' : 'member') : undefined;
    const data: any = { email, firstName, lastName };
    if (userRole !== undefined) data.role = userRole;
    if (isAdmin !== undefined) data.isAdmin = !!isAdmin;
    if (status !== undefined) {
      if (!['active', 'pending', 'inactive'].includes(status)) {
        res.status(400).json({ error: '無効なステータスです' });
        return;
      }
      data.status = status;
    }
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    if (groupIds) {
      await prisma.groupMember.deleteMany({ where: { userId } });
      data.groupMembers = {
        create: groupIds.map((groupId: number) => ({ groupId })),
      };
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, status: true, isAdmin: true,
        groupMembers: { select: { group: { select: { id: true, name: true } } } },
      },
    });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'ユーザーの更新に失敗しました' });
  }
});

router.delete('/users/:id', requirePermission('admin.users', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!targetUser) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    if (targetUser.status !== 'pending') {
      res.status(400).json({ error: '仮登録ユーザーのみ削除できます' });
      return;
    }
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'ユーザーを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'ユーザーの削除に失敗しました' });
  }
});

router.post('/users/:id/resend-registration-email', requirePermission('admin.users', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, status: true },
    });
    if (!targetUser) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    if (targetUser.status !== 'pending') {
      res.status(400).json({ error: '仮登録ユーザーのみ再送できます' });
      return;
    }

    const temporaryPassword = generateTemporaryPassword();
    try {
      await sendTemporaryPasswordEmail(
        targetUser.email,
        targetUser.firstName,
        targetUser.lastName,
        temporaryPassword,
      );
    } catch (emailErr) {
      console.error('Failed to resend temporary password email:', emailErr);
      res.status(502).json({ error: '登録メールの送信に失敗しました' });
      return;
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ message: '登録メールを再送しました' });
  } catch (e) {
    res.status(500).json({ error: '登録メールの再送に失敗しました' });
  }
});

// Trackers
router.get('/trackers', requirePermission('admin.trackers', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    // the generated client in this workspace may be out-of-date so we cast
    let trackers = await prisma.tracker.findMany({ orderBy: { position: 'asc' } as any });
    if (trackers.length === 0) {
      // no trackers yet, seed defaults so UI has something to display
      const defaultTrackers = [
        { name: 'バグ', position: 1 },
        { name: '機能', position: 2 },
        { name: 'タスク', position: 3 },
        { name: 'サポート', position: 4 },
      ];
      await prisma.tracker.createMany({ data: defaultTrackers });
      trackers = await prisma.tracker.findMany({ orderBy: { position: 'asc' } as any });
    }
    res.json(trackers);
  } catch (e) {
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

router.post('/trackers', requirePermission('admin.trackers', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    // place new tracker at end of list
    const max: any = await prisma.tracker.aggregate({ _max: { position: true } } as any);
    const nextPos = ((max._max?.position as number) ?? 0) + 1;
    res.status(201).json(
      await prisma.tracker.create({ data: { name: req.body.name, position: nextPos } as any })
    );
  } catch (e) {
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

router.put('/trackers/:id', requirePermission('admin.trackers', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, position } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (position !== undefined) data.position = position;
    const tracker = await prisma.tracker.update({ where: { id }, data });
    res.json(tracker);
  } catch (e) {
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.post('/trackers/reorder', requirePermission('admin.trackers', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids配列を指定してください' });
      return;
    }
    const ops = ids.map((id: number, idx: number) =>
      prisma.tracker.update({ where: { id }, data: { position: idx } as any })
    );
    await prisma.$transaction(ops);
    res.json({});
  } catch (e) {
    res.status(500).json({ error: '並び替えに失敗しました' });
  }
});

router.delete('/trackers/:id', requirePermission('admin.trackers', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.tracker.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '削除しました' });
  } catch (e) {
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

// Statuses
router.get('/statuses', requirePermission('admin.statuses', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await prisma.issueStatus.findMany({ orderBy: { position: 'asc' } }));
  } catch (e) {
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

router.post('/statuses', requirePermission('admin.statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, isClosed, position } = req.body;
    // when creating new status default to end
    const max = await prisma.issueStatus.aggregate({ _max: { position: true } });
    const nextPos = (max._max.position ?? 0) + 1;
    res.status(201).json(
      await prisma.issueStatus.create({ data: { name, isClosed: isClosed || false, position: position ?? nextPos } })
    );
  } catch (e) {
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

router.put('/statuses/:id', requirePermission('admin.statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, isClosed, position } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (isClosed !== undefined) data.isClosed = isClosed;
    if (position !== undefined) data.position = position;
    const status = await prisma.issueStatus.update({ where: { id }, data });
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.post('/statuses/reorder', requirePermission('admin.statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids配列を指定してください' });
      return;
    }
    const ops = ids.map((id: number, idx: number) =>
      prisma.issueStatus.update({ where: { id }, data: { position: idx } })
    );
    await prisma.$transaction(ops);
    res.json({});
  } catch (e) {
    res.status(500).json({ error: '並び替えに失敗しました' });
  }
});

router.delete('/statuses/:id', requirePermission('admin.statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.issueStatus.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '削除しました' });
  } catch (e) {
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

// Priorities
router.get('/priorities', requirePermission('admin.priorities', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await prisma.issuePriority.findMany({ orderBy: { position: 'asc' } }));
  } catch (e) {
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

router.post('/priorities', requirePermission('admin.priorities', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, position } = req.body;
    const max = await prisma.issuePriority.aggregate({ _max: { position: true } });
    const nextPos = (max._max.position ?? 0) + 1;
    res.status(201).json(
      await prisma.issuePriority.create({ data: { name, position: position ?? nextPos } })
    );
  } catch (e) {
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

router.put('/priorities/:id', requirePermission('admin.priorities', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, position } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (position !== undefined) data.position = position;
    const prio = await prisma.issuePriority.update({ where: { id }, data });
    res.json(prio);
  } catch (e) {
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.post('/priorities/reorder', requirePermission('admin.priorities', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids配列を指定してください' });
      return;
    }
    const ops = ids.map((id: number, idx: number) =>
      prisma.issuePriority.update({ where: { id }, data: { position: idx } })
    );
    await prisma.$transaction(ops);
    res.json({});
  } catch (e) {
    res.status(500).json({ error: '並び替えに失敗しました' });
  }
});

router.delete('/priorities/:id', requirePermission('admin.priorities', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.issuePriority.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '削除しました' });
  } catch (e) {
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

// Groups
router.get('/groups', requirePermission('admin.groups', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        _count: { select: { members: true } },
        permissionSet: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(groups);
  } catch (e) {
    res.status(500).json({ error: 'グループの取得に失敗しました' });
  }
});

router.get('/groups/:id', requirePermission('admin.groups', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        permissionSet: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
    if (!group) {
      res.status(404).json({ error: 'グループが見つかりません' });
      return;
    }
    res.json(group);
  } catch (e) {
    res.status(500).json({ error: 'グループの取得に失敗しました' });
  }
});

router.post('/groups', requirePermission('admin.groups', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, memberIds, permissionSetId } = req.body;
    const group = await prisma.group.create({
      data: {
        name,
        permissionSetId: permissionSetId ?? null,
        members: {
          create: (memberIds || []).map((userId: number) => ({ userId })),
        },
      },
      include: {
        _count: { select: { members: true } },
        permissionSet: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(group);
  } catch (e) {
    res.status(500).json({ error: 'グループの作成に失敗しました' });
  }
});

router.put('/groups/:id', requirePermission('admin.groups', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, memberIds, permissionSetId } = req.body;
    const groupId = Number(req.params.id);
    await prisma.groupMember.deleteMany({ where: { groupId } });
    const group = await prisma.group.update({
      where: { id: groupId },
      data: {
        name,
        ...(permissionSetId !== undefined && { permissionSetId: permissionSetId || null }),
        members: {
          create: (memberIds || []).map((userId: number) => ({ userId })),
        },
      },
      include: {
        _count: { select: { members: true } },
        permissionSet: { select: { id: true, name: true } },
      },
    });
    res.json(group);
  } catch (e) {
    res.status(500).json({ error: 'グループの更新に失敗しました' });
  }
});

router.delete('/groups/:id', requirePermission('admin.groups', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.group.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'グループを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'グループの削除に失敗しました' });
  }
});

// Roles
router.get('/roles', requirePermission('admin.roles', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        statuses: { include: { status: true }, orderBy: { status: { position: 'asc' } } },
        permissions: { include: { resource: { select: { id: true, code: true, name: true, resourceType: true } } } },
      },
      orderBy: { position: 'asc' },
    });
    res.json(roles);
  } catch (e: any) {
    console.error('ロール取得エラー:', {
      message: e.message,
      code: e.code,
      stack: e.stack,
    });
    res.status(500).json({ error: 'ロール取得に失敗しました', details: e.message });
  }
});

router.post('/roles', requirePermission('admin.roles', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, position, isDefaultRole } = req.body;
    const max = await prisma.role.aggregate({ _max: { position: true } });
    const nextPos = (max._max.position ?? 0) + 1;
    res.status(201).json(
      await prisma.role.create({
        data: { name, position: position ?? nextPos, isDefaultRole: !!isDefaultRole },
        include: {
          statuses: { include: { status: true } },
          permissions: { include: { resource: true } },
        },
      })
    );
  } catch (e) {
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

router.put('/roles/:id', requirePermission('admin.roles', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, position, statusIds, isDefaultRole, permissions } = req.body;
    const data: any = { name };
    if (position !== undefined) data.position = position;
    if (isDefaultRole !== undefined) {
      data.isDefaultRole = !!isDefaultRole;
    }

    // Update role statuses if provided
    if (Array.isArray(statusIds)) {
      await prisma.roleStatus.deleteMany({ where: { roleId: id } });
      data.statuses = {
        create: statusIds.map((statusId: number) => ({ statusId })),
      };
    }

    const role = await prisma.role.update({
      where: { id },
      data,
      include: { statuses: { include: { status: true }, orderBy: { status: { position: 'asc' } } } },
    });

    if (Array.isArray(permissions)) {
      const roleResourceIds = new Set(
        (await prisma.permissionResource.findMany({ where: { scope: 'role' }, select: { id: true } })).map((r) => r.id)
      );
      const seen = new Set<number>();
      const filtered: Array<{ resourceId: number; canUse: boolean; canInput: boolean }> = [];
      for (const p of permissions as Array<{ resourceId: number; canUse: boolean; canInput: boolean }>) {
        const resourceId = Number(p.resourceId);
        if (!roleResourceIds.has(resourceId) || seen.has(resourceId)) continue;
        seen.add(resourceId);
        filtered.push({
          resourceId,
          canUse: !!p.canUse,
          canInput: !!(p.canInput && p.canUse),
        });
      }
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (filtered.length > 0) {
        await prisma.rolePermission.createMany({
          data: filtered.map((p) => ({
            roleId: id,
            resourceId: p.resourceId,
            canUse: p.canUse,
            canInput: p.canInput,
          })),
        });
      }
      clearProjectPermissionCache();
    }

    const result = await prisma.role.findUnique({
      where: { id },
      include: {
        statuses: { include: { status: true }, orderBy: { status: { position: 'asc' } } },
        permissions: { include: { resource: { select: { id: true, code: true, name: true, resourceType: true } } } },
      },
    });
    res.json(result ?? role);
  } catch (e) {
    console.error('PUT /roles/:id failed:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.post('/roles/reorder', requirePermission('admin.roles', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids配列を指定してください' });
      return;
    }
    const ops = ids.map((id: number, idx: number) =>
      prisma.role.update({ where: { id }, data: { position: idx } })
    );
    await prisma.$transaction(ops);
    res.json({});
  } catch (e) {
    res.status(500).json({ error: '並び替えに失敗しました' });
  }
});

router.delete('/roles/:id', requirePermission('admin.roles', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.role.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '削除しました' });
  } catch (e) {
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

// Workflow transitions for a role
router.get('/roles/:id/transitions', requirePermission('admin.roles', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const roleId = Number(req.params.id);
    const transitions = await prisma.workflowTransition.findMany({
      where: { roleId },
      select: { oldStatusId: true, newStatusId: true },
    });
    res.json(transitions);
  } catch (e) {
    res.status(500).json({ error: 'ワークフロー遷移の取得に失敗しました' });
  }
});

router.put('/roles/:id/transitions', requirePermission('admin.roles', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const roleId = Number(req.params.id);
    const { transitions } = req.body;
    if (!Array.isArray(transitions)) {
      res.status(400).json({ error: 'transitions配列を指定してください' });
      return;
    }
    await prisma.$transaction(async (tx: any) => { // Added explicit any to tx
      await tx.workflowTransition.deleteMany({ where: { roleId } });
      await Promise.all(transitions.map((t: { oldStatusId: number; newStatusId: number }) =>
        tx.workflowTransition.create({
          data: { roleId, oldStatusId: t.oldStatusId, newStatusId: t.newStatusId },
        })
      ));
    });
    const updated = await prisma.workflowTransition.findMany({
      where: { roleId },
      select: { oldStatusId: true, newStatusId: true },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'ワークフロー遷移の更新に失敗しました' });
  }
});

// Companies
router.get('/companies', requirePermission('companies', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        legalEntityStatus: true,
        _count: { select: { projects: true, wikiPages: true, comments: true, locations: true } }
      },
      orderBy: { name: 'asc' },
    });
    res.json(companies);
  } catch (e) {
    console.error('admin.getCompanies error:', e);
    res.status(500).json({ error: '企業の取得に失敗しました' });
  }
});

router.get('/companies/:id', requirePermission('companies', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.query.companyId ? Number(req.query.companyId as string) : undefined;
    const userId = req.query.userId ? Number(req.query.userId as string) : undefined;
    const company = await prisma.company.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        projects: { select: { id: true, name: true, identifier: true, status: true } },
        legalEntityStatus: true,
        locations: true,
        associations: {
          include: { association: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { comments: true, wikiPages: true, projects: true, locations: true },
        },
      },
    });
    if (!company) {
      res.status(404).json({ error: '企業が見つかりません' });
      return;
    }
    res.json(company);
  } catch (e) {
    console.error('admin.getCompanyDetail error:', e);
    res.status(500).json({ error: '企業の取得に失敗しました' });
  }
});

router.post('/companies', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, legalEntityStatusId, legalEntityPosition, postalCode, prefecture, city, street, building, phone, website, notes, latitude, longitude } = req.body;
    
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name,
          legalEntityStatusId: legalEntityStatusId ? Number(legalEntityStatusId) : null,
          legalEntityPosition,
          postalCode,
          prefecture,
          city,
          street,
          building,
          phone,
          website,
          notes,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null
        } as any,
      });

      // 拠点（本社）の初期登録
      await tx.location.create({
        data: {
          companyId: company.id,
          name: '本社',
          phone,
          postalCode,
          prefecture,
          city,
          street,
          building,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
        }
      });

      return company;
    });

    res.status(201).json(result);
  } catch (e) {
    console.error('admin.createCompany error:', e);
    res.status(500).json({ error: '企業の作成に失敗しました' });
  }
});

router.put('/companies/:id', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, legalEntityStatusId, legalEntityPosition, postalCode, prefecture, city, street, building, phone, website, notes, latitude, longitude } = req.body;
    const companyId = Number(req.params.id);

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name,
        legalEntityStatusId: legalEntityStatusId ? Number(legalEntityStatusId) : null,
        legalEntityPosition,
        postalCode,
        prefecture,
        city,
        street,
        building,
        phone,
        website,
        notes,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null
      } as any,
    });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: '企業の更新に失敗しました' });
  }
});

router.delete('/companies/:id', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.company.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '企業を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '企業の削除に失敗しました' });
  }
});

// Legal Entity Statuses
router.get('/legal-entity-statuses', requirePermission('legal-entity-statuses', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const statuses = await prisma.legalEntityStatus.findMany({
      orderBy: { position: 'asc' },
    });
    res.json(statuses);
  } catch (e) {
    res.status(500).json({ error: '法人格の取得に失敗しました' });
  }
});

router.post('/legal-entity-statuses', requirePermission('legal-entity-statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const max = await prisma.legalEntityStatus.aggregate({ _max: { position: true } });
    const nextPos = (max._max.position ?? 0) + 1;
    const status = await prisma.legalEntityStatus.create({
      data: { name, position: nextPos },
    });
    res.status(201).json(status);
  } catch (e) {
    res.status(500).json({ error: '法人格の作成に失敗しました' });
  }
});

router.put('/legal-entity-statuses/:id', requirePermission('legal-entity-statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, position } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (position !== undefined) data.position = position;
    const status = await prisma.legalEntityStatus.update({ where: { id }, data });
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: '法人格の更新に失敗しました' });
  }
});

router.post('/legal-entity-statuses/reorder', requirePermission('legal-entity-statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids配列を指定してください' });
      return;
    }
    const ops = ids.map((id: number, idx: number) =>
      prisma.legalEntityStatus.update({ where: { id }, data: { position: idx } })
    );
    await prisma.$transaction(ops);
    res.json({});
  } catch (e) {
    res.status(500).json({ error: '並び替えに失敗しました' });
  }
});

router.delete('/legal-entity-statuses/:id', requirePermission('legal-entity-statuses', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.legalEntityStatus.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: '法人格を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '法人格の削除に失敗しました' });
  }
});

// Associations
router.get('/associations', requirePermission('associations', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const associationId = _req.query.associationId ? parseInt(_req.query.associationId as string) : undefined;
    const associations = await prisma.association.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(associations);
  } catch (e) {
    res.status(500).json({ error: '協会の取得に失敗しました' });
  }
});

router.post('/associations', requirePermission('associations', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, postalCode, prefecture, city, street, building, phone, website, notes, latitude, longitude } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '協会名は必須です' });
    }

    const association = await prisma.association.create({
      data: {
        name,
        postalCode: postalCode || null,
        prefecture: prefecture || null,
        city: city || null,
        street: street || null,
        building: building || null,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      },
    });

    res.status(201).json(association);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'この協会名は既に存在します' });
    }
    res.status(500).json({ error: '協会の作成に失敗しました' });
  }
});

router.put('/associations/:id', requirePermission('associations', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, postalCode, prefecture, city, street, building, phone, website, notes, latitude, longitude } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '協会名は必須です' });
    }

    const association = await prisma.association.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        postalCode: postalCode || null,
        prefecture: prefecture || null,
        city: city || null,
        street: street || null,
        building: building || null,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      },
    });

    res.json(association);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'この協会名は既に存在します' });
    }
    res.status(500).json({ error: '協会の更新に失敗しました' });
  }
});

router.delete('/associations/:id', requirePermission('associations', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.association.delete({
      where: { id: Number(req.params.id) },
    });

    res.json({ message: '協会を削除しました' });
  } catch (e) {
    res.status(500).json({ error: '協会の削除に失敗しました' });
  }
});

// Company Associations
router.post('/companies/:id/associations/:associationId', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.id);
    const associationId = Number(req.params.associationId);

    const ca = await prisma.companyAssociation.create({
      data: { companyId, associationId },
    });
    res.status(201).json(ca);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'この協会は既に割り当てられています' });
    }
    res.status(500).json({ error: '協会の割り当てに失敗しました' });
  }
});

router.delete('/companies/:id/associations/:associationId', requirePermission('companies', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = Number(req.params.id);
    const associationId = Number(req.params.associationId);

    await prisma.companyAssociation.delete({
      where: {
        companyId_associationId: { companyId, associationId },
      },
    });
    res.json({ message: '協会の割り当てを解除しました' });
  } catch (e) {
    res.status(500).json({ error: '協会の割り当て解除に失敗しました' });
  }
});

// System Settings
router.get('/settings/time', requirePermission('admin.time-settings', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    let setting = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
    if (!setting) {
      setting = await prisma.systemSetting.create({
        data: { id: 'default', startTime: '09:00', endTime: '18:00', managementTimes: [], conversionTimes: [] }
      });
    }
    res.json(setting);
  } catch (e: any) {
    console.error('Error fetching time settings:', e);
    res.status(500).json({ error: '設定の取得に失敗しました', details: e.message || e });
  }
});

router.put('/settings/time', requirePermission('admin.time-settings', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { startTime, endTime, managementTimes, conversionTimes } = req.body;

    // Validate conversionTimes are integers
    const validatedConversionTimes = Array.isArray(conversionTimes)
      ? conversionTimes.map(v => Math.floor(Number(v) || 0))
      : [];

    const setting = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: { startTime, endTime, managementTimes, conversionTimes: validatedConversionTimes },
      create: { id: 'default', startTime, endTime, managementTimes, conversionTimes: validatedConversionTimes },
    });
    res.json(setting);
  } catch (e: any) {
    console.error('Error updating time settings:', e);
    res.status(500).json({ error: '設定の更新に失敗しました', details: e.message || e });
  }
});

function emailSettingsDto(row: Awaited<ReturnType<typeof prisma.systemSetting.findUnique>>) {
  if (!row) {
    return {
      emailTransport: 'ses' as const,
      emailFromOverride: null as string | null,
      smtpHost: null as string | null,
      smtpPort: 587,
      smtpUser: null as string | null,
      smtpSecure: false,
      smtpPasswordSet: false,
    };
  }
  return {
    emailTransport: row.emailTransport === 'smtp' ? ('smtp' as const) : ('ses' as const),
    emailFromOverride: row.emailFromOverride,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
    smtpSecure: row.smtpSecure,
    smtpPasswordSet: !!(row.smtpPasswordEnc && row.smtpPasswordEnc.length > 0),
  };
}

router.get('/settings/email', requirePermission('admin.email-settings', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
    res.json(emailSettingsDto(row));
  } catch (e: any) {
    console.error('Error fetching email settings:', e);
    res.status(500).json({ error: 'メール設定の取得に失敗しました', details: e.message || e });
  }
});

router.put('/settings/email', requirePermission('admin.email-settings', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
    const {
      emailTransport,
      emailFromOverride: rawFrom,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpSecure,
      smtpPassword,
    } = req.body;

    if (emailTransport !== 'ses' && emailTransport !== 'smtp') {
      res.status(400).json({ error: 'emailTransport は ses または smtp です' });
      return;
    }

    const emailFromOverride =
      rawFrom === '' || rawFrom === null || rawFrom === undefined
        ? null
        : String(rawFrom).trim() || null;

    const smtpHostNorm =
      smtpHost === '' || smtpHost === null || smtpHost === undefined
        ? null
        : String(smtpHost).trim() || null;
    const smtpUserNorm =
      smtpUser === '' || smtpUser === null || smtpUser === undefined
        ? null
        : String(smtpUser).trim() || null;
    const port = Math.floor(Number(smtpPort) || 587);

    if (emailTransport === 'smtp') {
      if (!smtpHostNorm || !smtpUserNorm) {
        res.status(400).json({ error: 'SMTP 利用時はホストとユーザー名が必須です' });
        return;
      }
      const hasNewPass = typeof smtpPassword === 'string' && smtpPassword.length > 0;
      if (!existing?.smtpPasswordEnc && !hasNewPass) {
        res.status(400).json({ error: 'SMTP パスワードを設定してください' });
        return;
      }
    }

    let smtpPasswordEnc = existing?.smtpPasswordEnc ?? null;
    if (typeof smtpPassword === 'string' && smtpPassword.length > 0) {
      smtpPasswordEnc = encryptSecret(smtpPassword);
    }

    const updatePayload = {
      emailTransport,
      emailFromOverride,
      smtpHost: smtpHostNorm,
      smtpPort: port,
      smtpUser: smtpUserNorm,
      smtpSecure: smtpSecure === true || smtpSecure === 'true',
      smtpPasswordEnc,
    };

    const setting = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: updatePayload,
      create: {
        id: 'default',
        startTime: '09:00',
        endTime: '18:00',
        managementTimes: [],
        conversionTimes: [],
        ...updatePayload,
      },
    });

    res.json(emailSettingsDto(setting));
  } catch (e: any) {
    console.error('Error updating email settings:', e);
    res.status(500).json({ error: 'メール設定の更新に失敗しました', details: e.message || e });
  }
});

router.post('/settings/email/test', requirePermission('admin.email-settings', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { toEmail } = req.body;
    if (!toEmail || typeof toEmail !== 'string') {
      res.status(400).json({ error: '宛先メールアドレスを指定してください' });
      return;
    }
    const trimmed = toEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      res.status(400).json({ error: '有効なメールアドレス形式ではありません' });
      return;
    }
    await sendTestEmail(trimmed);
    res.json({ message: 'テストメールを送信しました' });
  } catch (e: any) {
    console.error('Test email failed:', e);
    res.status(500).json({
      error: 'テストメールの送信に失敗しました',
      details: e?.message || String(e),
    });
  }
});

router.get('/settings/holidays', requirePermission('admin.holiday-settings', 'use'), async (_req: AuthRequest, res: Response) => {
  try {
    const setting = await getOrCreateSystemSetting(prisma);
    res.json(holidaySettingsDto(setting));
  } catch (e: any) {
    console.error('Error fetching holiday settings:', e);
    res.status(500).json({ error: '休日設定の取得に失敗しました', details: e.message || e });
  }
});

router.put('/settings/holidays', requirePermission('admin.holiday-settings', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const weekdays = parseHolidayWeekdays(req.body.holidayWeekdays);
    if ('error' in weekdays) {
      res.status(400).json({ error: weekdays.error });
      return;
    }
    const holidays = parseHolidayDateEntries(req.body.holidays, 'holidays');
    if ('error' in holidays) {
      res.status(400).json({ error: holidays.error });
      return;
    }
    const workdays = parseHolidayDateEntries(req.body.workdays, 'workdays');
    if ('error' in workdays) {
      res.status(400).json({ error: workdays.error });
      return;
    }

    const updatePayload = {
      holidayWeekdays: weekdays,
      holidays,
      workdays,
    };

    const setting = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: updatePayload,
      create: {
        id: 'default',
        startTime: '09:00',
        endTime: '18:00',
        managementTimes: [],
        conversionTimes: [],
        ...updatePayload,
      },
    });

    res.json(holidaySettingsDto(setting));
  } catch (e: any) {
    console.error('Error updating holiday settings:', e);
    res.status(500).json({ error: '休日設定の更新に失敗しました', details: e.message || e });
  }
});

export default router;
