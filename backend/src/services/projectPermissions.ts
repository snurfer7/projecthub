import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import {
  PermissionEntry,
  PermissionMap,
  applyInheritanceScoped,
  boostParentPermissionsFromChildren,
  expandLegacyFieldAliases,
  hasPermission,
} from './permissions';
import {
  isProjectMember,
  isRequestAdmin,
  sendProjectAccessDenied,
} from './projectAccess';

const prisma = new PrismaClient();

export const PROJECT_PERMISSION_DENIED_MESSAGE = 'このプロジェクトでの操作権限がありません';

let roleResourceCache: Array<{
  id: number;
  code: string;
  parentId: number | null;
}> | null = null;

async function getRoleResources() {
  const count = await prisma.permissionResource.count({ where: { scope: 'role' } });
  if (roleResourceCache === null || roleResourceCache.length !== count) {
    roleResourceCache = await prisma.permissionResource.findMany({
      where: { scope: 'role' },
      select: { id: true, code: true, parentId: true },
    });
  }
  return roleResourceCache;
}

export function clearProjectPermissionCache() {
  roleResourceCache = null;
}

/**
 * Resolve role-scoped permissions for a user on a project (OR across assigned roles).
 * System isAdmin does not grant role permissions.
 */
export async function resolveProjectPermissions(
  userId: number,
  projectId: number
): Promise<PermissionMap> {
  if (!Number.isFinite(projectId) || projectId <= 0) return {};

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: {
      roles: {
        select: {
          role: {
            select: {
              permissions: {
                include: { resource: { select: { code: true, scope: true } } },
              },
            },
          },
        },
      },
    },
  });

  const merged = new Map<string, PermissionEntry>();
  if (member) {
    for (const pr of member.roles) {
      for (const p of pr.role.permissions) {
        if (p.resource.scope !== 'role') continue;
        const code = p.resource.code;
        const existing = merged.get(code) ?? { canUse: false, canInput: false };
        merged.set(code, {
          canUse: existing.canUse || p.canUse,
          canInput: existing.canInput || p.canInput,
        });
      }
    }
  }

  const resources = await getRoleResources();
  boostParentPermissionsFromChildren(merged, resources);
  const inherited = applyInheritanceScoped(merged, resources);
  return expandLegacyFieldAliases(inherited);
}

export async function hasProjectPermission(
  userId: number,
  projectId: number,
  code: string,
  action: 'use' | 'input'
): Promise<boolean> {
  const map = await resolveProjectPermissions(userId, projectId);
  return hasPermission(map, code, action);
}

export async function getProjectIdsWithPermission(
  userId: number,
  projectIds: number[],
  code: string,
  action: 'use' | 'input'
): Promise<number[]> {
  if (projectIds.length === 0) return [];
  const result: number[] = [];
  for (const projectId of projectIds) {
    if (await hasProjectPermission(userId, projectId, code, action)) {
      result.push(projectId);
    }
  }
  return result;
}

/**
 * Middleware: require role-scoped project permission.
 * Resolves projectId from req.params[paramName] by default.
 * Optionally use `resolveProjectId` for body/issue-based lookup.
 */
export function requireProjectPermission(
  code: string,
  action: 'use' | 'input' = 'use',
  options?: {
    paramName?: string;
    resolveProjectId?: (req: AuthRequest) => Promise<number | null>;
  }
) {
  const paramName = options?.paramName ?? 'id';
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
        return;
      }

      let projectId: number | null = null;
      if (options?.resolveProjectId) {
        projectId = await options.resolveProjectId(req);
      } else {
        projectId = Number(req.params[paramName]);
      }

      if (projectId == null || !Number.isFinite(projectId) || projectId <= 0) {
        res.status(400).json({ error: 'プロジェクトが特定できません' });
        return;
      }

      const admin = isRequestAdmin(req);
      if (!(await isProjectMember(req.userId, projectId, admin))) {
        sendProjectAccessDenied(res);
        return;
      }

      if (!(await hasProjectPermission(req.userId, projectId, code, action))) {
        res.status(403).json({ error: PROJECT_PERMISSION_DENIED_MESSAGE });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: 'プロジェクト権限の確認に失敗しました' });
    }
  };
}

/** Grant all role-scoped resources to every Role (seed / migration). */
export async function grantFullRolePermissionsToAllRoles(): Promise<void> {
  const roles = await prisma.role.findMany({ select: { id: true } });
  const resources = await prisma.permissionResource.findMany({
    where: { scope: 'role' },
    select: { id: true },
  });
  for (const role of roles) {
    for (const resource of resources) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_resourceId: { roleId: role.id, resourceId: resource.id },
        },
        create: {
          roleId: role.id,
          resourceId: resource.id,
          canUse: true,
          canInput: true,
        },
        update: { canUse: true, canInput: true },
      });
    }
  }
}

/** Remove PermissionSetPermission rows for role-scoped resources. */
export async function pruneRoleScopedFromPermissionSets(): Promise<void> {
  const roleResources = await prisma.permissionResource.findMany({
    where: { scope: 'role' },
    select: { id: true },
  });
  if (roleResources.length === 0) return;
  await prisma.permissionSetPermission.deleteMany({
    where: { resourceId: { in: roleResources.map((r) => r.id) } },
  });
}
