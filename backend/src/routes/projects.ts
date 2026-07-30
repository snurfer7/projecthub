import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import {
  requireProjectMember,
  projectListAccessWhere,
  isRequestAdmin,
} from '../services/projectAccess';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List projects (member projects only)
router.get('/', requirePermission('projects', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: projectListAccessWhere(req.userId!, isRequestAdmin(req)),
      include: {
        company: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        parent: { select: { id: true, name: true } },
        relatedCompanies: {
          include: {
            company: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
          }
        },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            roles: { include: { role: true } },
          },
        },
        groups: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
              },
            },
          },
        },
        _count: { select: { issues: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの取得に失敗しました' });
  }
});

// Get project
router.get('/:id', requirePermission('projects', 'use'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: Number(req.params.id) },
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
            group: {
              select: {
                id: true,
                name: true,
                members: {
                  include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                  },
                },
              },
            },
          },
        },
        _count: { select: { issues: true, wikiPages: true, attachments: true, timeEntries: true, comments: true } },
      },
    });
    if (!project) {
      res.status(404).json({ error: 'プロジェクトが見つかりません' });
      return;
    }
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの取得に失敗しました' });
  }
});

// Create project
router.post('/', requirePermission('projects', 'input'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, identifier, description, companyId, locationId, contactId, parentId, dueDate, remarks, relatedCompanies } = req.body;

    if (!name || !identifier) {
      return res.status(400).json({ error: 'プロジェクト名と識別子が必要です' });
    }

    // Role for the creator
    const managerRole = await prisma.role.findFirst({ where: { name: '管理者' } }) || await prisma.role.findFirst();
    if (!managerRole) return res.status(500).json({ error: 'ロールが見つかりません' });

    const project = await prisma.project.create({
      data: {
        name,
        identifier,
        description,
        companyId: companyId ? Number(companyId) : null,
        locationId: locationId ? Number(locationId) : null,
        contactId: contactId ? Number(contactId) : null,
        parentId: parentId ? Number(parentId) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        remarks,
        relatedCompanies: {
          create: (relatedCompanies || []).map((rc: any) => ({
            companyId: Number(rc.companyId),
            locationId: rc.locationId ? Number(rc.locationId) : null,
            contactId: rc.contactId ? Number(rc.contactId) : null,
            remarks: rc.remarks
          }))
        },
        members: {
          create: {
            userId: req.userId!,
            roles: { create: { roleId: managerRole.id, sourceGroupId: null } }
          }
        },
      },
    });
    res.status(201).json(project);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'この識別子は既に使用されています。再生成してください。' });
    }
    res.status(500).json({ error: 'プロジェクトの作成に失敗しました', details: e.message });
  }
});

// Update project
router.put('/:id', requirePermission('projects', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
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
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの更新に失敗しました' });
  }
});

// Delete project
router.delete('/:id', requirePermission('projects', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.project.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'プロジェクトを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの削除に失敗しました' });
  }
});

// Add individual member with multiple roles
router.post('/:id/members', requirePermission('projects.members', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
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
    res.status(201).json(newMember);
  } catch (e: any) {
    console.error('Add member error:', e);
    res.status(500).json({ error: 'メンバーの追加に失敗しました', details: e.message });
  }
});

// Update member roles (only individual roles)
router.put('/:id/members/:memberId', requirePermission('projects.members', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const { roleIds } = req.body; // roleIds for individual assignment
    const memberId = Number(req.params.memberId);

    if (!Array.isArray(roleIds)) {
      res.status(400).json({ error: 'ロールを配列で指定してください' });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      // Delete existing individual roles
      await tx.projectMemberRole.deleteMany({
        where: { projectMemberId: memberId, sourceGroupId: null }
      });

      // Add new individual roles
      if (roleIds.length > 0) {
        await tx.projectMemberRole.createMany({
          data: roleIds.map((id: number) => ({
            projectMemberId: memberId,
            roleId: Number(id),
            sourceGroupId: null
          }))
        });
      }

      // If no roles left at all (including group roles), delete the member
      const rolesCount = await tx.projectMemberRole.count({
        where: { projectMemberId: memberId }
      });
      if (rolesCount === 0) {
        await tx.projectMember.delete({ where: { id: memberId } });
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

// Remove individual roles (effectively deleting the member if no group roles exist)
router.delete('/:id/members/:memberId', requirePermission('projects.members', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const memberId = Number(req.params.memberId);
    await prisma.$transaction(async (tx: any) => {
      await tx.projectMemberRole.deleteMany({
        where: { projectMemberId: memberId, sourceGroupId: null }
      });
      // If no roles left at all (including group roles), delete the member
      const rolesCount = await tx.projectMemberRole.count({
        where: { projectMemberId: memberId }
      });
      if (rolesCount === 0) {
        await tx.projectMember.delete({ where: { id: memberId } });
      }
    });
    res.json({ message: '個別ロールを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'メンバーの削除に失敗しました' });
  }
});

// Get available roles
router.get('/roles/available', requirePermission('projects.members', 'use'), async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { position: 'asc' } });
    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: 'ロール一覧の取得に失敗しました' });
  }
});

// Get groups assigned to project
router.get('/:id/groups', requirePermission('projects.members', 'use'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const projectGroups = await (prisma as any).projectGroup.findMany({
      where: { projectId: Number(req.params.id) },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
          },
        },
      },
    });
    res.json(projectGroups);
  } catch (e) {
    res.status(500).json({ error: 'グループ一覧の取得に失敗しました' });
  }
});

// Assign group to project
router.post('/:id/groups', requirePermission('projects.members', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { groupId, roleIds } = req.body;

    if (!groupId || !Array.isArray(roleIds) || roleIds.length === 0) {
      res.status(400).json({ error: 'groupId と roleIds は必須です' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: Number(groupId) },
      include: { members: true },
    });
    if (!group) {
      res.status(404).json({ error: 'グループが見つかりません' });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      await (tx as any).projectGroup.create({
        data: { projectId, groupId: Number(groupId) },
      });

      for (const gm of group.members) {
        let member = await tx.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: gm.userId } }
        });
        if (!member) {
          member = await tx.projectMember.create({
            data: { projectId, userId: gm.userId }
          });
        }
        // Add only roles the member doesn't already have
        const existingRoles = await tx.projectMemberRole.findMany({
          where: { projectMemberId: member.id },
          select: { roleId: true, sourceGroupId: true }
        });
        
        const existingRoleIds = new Set(existingRoles.map((r: any) => r.roleId));
        
        for (const rId of roleIds) {
          const numericRoleId = Number(rId);
          if (!existingRoleIds.has(numericRoleId)) {
            await tx.projectMemberRole.create({
              data: {
                projectMemberId: member.id,
                roleId: numericRoleId,
                sourceGroupId: Number(groupId)
              }
            });
          }
        }
      }
    });

    const pg = await (prisma as any).projectGroup.findFirst({
      where: { projectId, groupId: Number(groupId) },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
          },
        },
      },
    });
    res.status(201).json(pg);
  } catch (e: any) {
    console.error('Assign group error:', e);
    if (e.code === 'P2002') {
      res.status(400).json({ error: 'このグループは既に割り当てられています' });
      return;
    }
    res.status(500).json({ error: 'グループの追加に失敗しました', details: e.message });
  }
});

// Update group-sourced roles
router.put('/:id/groups/:groupId/role', requirePermission('projects.members', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const groupId = Number(req.params.groupId);
    const { roleIds } = req.body; // roleIds should be an array

    if (!Array.isArray(roleIds)) {
      res.status(400).json({ error: 'roleIds を配列で指定してください' });
      return;
    }

    await prisma.$transaction(async (tx: any) => {
      // Find group members who are in this project (same approach as the POST endpoint)
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: { members: { select: { userId: true } } }
      });
      const groupUserIds = (group?.members || []).map((m: any) => m.userId);
      const members = await tx.projectMember.findMany({
        where: { projectId, userId: { in: groupUserIds } }
      });

      // Delete old roles for this group
      await tx.projectMemberRole.deleteMany({
        where: {
          member: { projectId },
          sourceGroupId: groupId
        }
      });

      for (const member of members) {
        for (const rId of roleIds) {
          await tx.projectMemberRole.create({
            data: {
              projectMemberId: member.id,
              roleId: Number(rId),
              sourceGroupId: groupId
            }
          });
        }
      }
    });

    res.json({ message: 'グループのロールを更新しました' });
  } catch (e) {
    res.status(500).json({ error: 'グループのロール更新に失敗しました' });
  }
});

// Remove group from project
router.delete('/:id/groups/:groupId', requirePermission('projects.members', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const groupId = Number(req.params.groupId);

    await prisma.$transaction(async (tx: any) => {
      // Get members of the group being removed
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: { members: { select: { userId: true } } }
      });
      const groupUserIds: number[] = (group?.members || []).map((m: any) => m.userId);

      // Find other groups still assigned to this project
      const otherAssignedGroupIds = (await tx.projectGroup.findMany({
        where: { projectId, groupId: { not: groupId } },
        select: { groupId: true }
      })).map((pg: any) => pg.groupId);

      // Collect user IDs that belong to other assigned groups
      const usersInOtherGroups = new Set<number>();
      for (const otherGId of otherAssignedGroupIds) {
        const otherGroup = await tx.group.findUnique({
          where: { id: otherGId },
          include: { members: { select: { userId: true } } }
        });
        (otherGroup?.members || []).forEach((m: any) => usersInOtherGroups.add(m.userId));
      }

      // Only remove members who are NOT in any other assigned group
      const userIdsToRemove = groupUserIds.filter(uid => !usersInOtherGroups.has(uid));
      if (userIdsToRemove.length > 0) {
        await tx.projectMember.deleteMany({
          where: { projectId, userId: { in: userIdsToRemove } }
        });
      }

      await tx.projectGroup.deleteMany({
        where: { projectId, groupId }
      });
    });

    res.json({ message: 'グループの割り当てを解除しました' });
  } catch (e) {
    res.status(500).json({ error: 'グループの削除に失敗しました' });
  }
});

// Get project comments
router.get('/:id/comments', requirePermission('projects.comments', 'use'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
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
router.post('/:id/comments', requirePermission('projects.comments', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
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
    res.status(201).json(comment);
  } catch (e) {
    res.status(500).json({ error: 'コメントの追加に失敗しました' });
  }
});

// Update project comment
router.put('/:id/comments/:commentId', requirePermission('projects.comments', 'input'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
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

// Get activities linked to project (N:N)
router.get('/:id/activities', requirePermission('projects.activities', 'use'), requireProjectMember('id'), async (req: AuthRequest, res: Response) => {
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
