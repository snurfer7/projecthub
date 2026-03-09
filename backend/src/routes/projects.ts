import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// List projects
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        company: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
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
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        company: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
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
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, identifier, description, companyId, parentId, dueDate } = req.body;

    if (!req.userId) {
      res.status(401).json({ error: 'ユーザーが認証されていません' });
      return;
    }

    const managerRole = await prisma.role.findFirst({ where: { isDefaultRole: true } });
    if (!managerRole) {
      res.status(500).json({ error: 'プロジェクトの初期ロールが設定されていません。管理画面のロール設定で「プロジェクトの初期ロール」を有効にしてください。' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name,
        identifier,
        description,
        companyId: companyId ? Number(companyId) : null,
        parentId: parentId ? Number(parentId) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        members: {
          create: {
            userId: req.userId,
            roles: { create: { roleId: managerRole.id, sourceGroupId: null } }
          }
        },
      },
    });
    res.status(201).json(project);
  } catch (e: any) {
    res.status(500).json({ error: 'プロジェクトの作成に失敗しました', details: e.message });
  }
});

// Update project
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, status, companyId, parentId, dueDate } = req.body;
    const data: any = { name, description, status };
    if (companyId !== undefined) data.companyId = companyId ? Number(companyId) : null;
    if (parentId !== undefined) data.parentId = parentId ? Number(parentId) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
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
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.project.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'プロジェクトを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'プロジェクトの削除に失敗しました' });
  }
});

// Add individual member with multiple roles
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { userId, roleIds } = req.body; // roleIds should be an array

    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      res.status(400).json({ error: 'ロールを指定してください' });
      return;
    }

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: Number(userId) } }
    });

    if (member) {
      // Add individual roles to existing member
      await prisma.projectMemberRole.createMany({
        data: roleIds.map((id: number) => ({
          projectMemberId: member.id,
          roleId: Number(id),
          sourceGroupId: null
        }))
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
          create: roleIds.map((id: number) => ({ roleId: Number(id), sourceGroupId: null }))
        }
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, roles: { include: { role: true } } },
    });
    res.status(201).json(newMember);
  } catch (e) {
    res.status(500).json({ error: 'メンバーの追加に失敗しました' });
  }
});

// Update member roles (only individual roles)
router.put('/:id/members/:memberId', async (req: AuthRequest, res: Response) => {
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
    res.json(member || { message: 'メンバーを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'ロールの更新に失敗しました' });
  }
});

// Remove individual roles (effectively deleting the member if no group roles exist)
router.delete('/:id/members/:memberId', async (req: AuthRequest, res: Response) => {
  try {
    const memberId = Number(req.params.memberId);
    await prisma.$transaction(async (tx: any) => {
      await tx.projectMemberRole.deleteMany({
        where: { projectMemberId: memberId, sourceGroupId: null }
      });
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
router.get('/roles/available', async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { position: 'asc' } });
    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: 'ロール一覧の取得に失敗しました' });
  }
});

// Get groups assigned to project
router.get('/:id/groups', async (req: AuthRequest, res: Response) => {
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
router.post('/:id/groups', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { groupId, roleIds } = req.body; // roleIds should be an array

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
        const existingRoleIds = new Set(
          (await tx.projectMemberRole.findMany({
            where: { projectMemberId: member.id },
            select: { roleId: true }
          })).map((r: any) => r.roleId)
        );
        for (const rId of roleIds) {
          if (!existingRoleIds.has(Number(rId))) {
            await tx.projectMemberRole.create({
              data: {
                projectMemberId: member.id,
                roleId: Number(rId),
                sourceGroupId: null
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
    if (e.code === 'P2002') {
      res.status(400).json({ error: 'このグループは既に割り当てられています' });
      return;
    }
    res.status(500).json({ error: 'グループの追加に失敗しました' });
  }
});

// Update group-sourced roles
router.put('/:id/groups/:groupId/role', async (req: AuthRequest, res: Response) => {
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
router.delete('/:id/groups/:groupId', async (req: AuthRequest, res: Response) => {
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
router.get('/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const comments = await (prisma as any).projectComment.findMany({
      where: { projectId: Number(req.params.id) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: 'コメントの取得に失敗しました' });
  }
});

// Create project comment
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
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

// Delete project comment
router.delete('/:id/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = Number(req.params.commentId);
    await (prisma as any).projectComment.delete({
      where: { id: commentId },
    });
    res.json({ message: 'コメントを削除しました' });
  } catch (e) {
    res.status(500).json({ error: 'コメントの削除に失敗しました' });
  }
});

export default router;
