import { PrismaClient } from '@prisma/client';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getAccessibleProjectIdsForUser,
  projectAccessWhereForUser,
  userHasProjectAccess,
} from './projectMembership';

const prisma = new PrismaClient();

export const PROJECT_ACCESS_DENIED_MESSAGE = 'このプロジェクトを参照する権限がありません';

export class ProjectAccessDeniedError extends Error {
  readonly status = 403;

  constructor(message = PROJECT_ACCESS_DENIED_MESSAGE) {
    super(message);
    this.name = 'ProjectAccessDeniedError';
  }
}

/** True when JWT marks the user as system admin (`isAdmin`). */
export function isRequestAdmin(req: AuthRequest): boolean {
  if (req.isAdmin === true) return true;
  if (req.isAdmin === undefined && req.userRole === 'admin') return true;
  return false;
}

/**
 * Project IDs the user may access.
 * `isAdmin` users get every project ID.
 */
export async function getAccessibleProjectIds(userId: number, isAdmin = false): Promise<number[]> {
  if (isAdmin) {
    const projects = await prisma.project.findMany({ select: { id: true } });
    return projects.map((p) => p.id);
  }
  return getAccessibleProjectIdsForUser(userId);
}

/** Prisma `where` fragment for listing projects the user can see. */
export async function projectListAccessWhere(
  userId: number,
  isAdmin = false
): Promise<Record<string, unknown>> {
  if (isAdmin) return {};
  return projectAccessWhereForUser(userId);
}

export async function isProjectMember(userId: number, projectId: number, isAdmin = false): Promise<boolean> {
  if (isAdmin) return Number.isFinite(projectId) && projectId > 0;
  if (!Number.isFinite(projectId) || projectId <= 0) return false;
  return userHasProjectAccess(userId, projectId);
}

export async function assertProjectMember(
  userId: number,
  projectId: number,
  isAdmin = false
): Promise<void> {
  const ok = await isProjectMember(userId, projectId, isAdmin);
  if (!ok) throw new ProjectAccessDeniedError();
}

/** Resolve projectId from an issue id; returns null if issue missing. */
export async function getProjectIdForIssue(issueId: number): Promise<number | null> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true },
  });
  return issue?.projectId ?? null;
}

/** Resolve projectId from attachment foreign keys. Returns null if company-only or unresolved. */
export async function resolveAttachmentProjectId(attachment: {
  projectId: number | null;
  issueId: number | null;
  issueCommentId: number | null;
  projectCommentId: number | null;
}): Promise<number | null> {
  if (attachment.projectId != null) return attachment.projectId;

  if (attachment.issueId != null) {
    return getProjectIdForIssue(attachment.issueId);
  }

  if (attachment.issueCommentId != null) {
    const comment = await prisma.issueComment.findUnique({
      where: { id: attachment.issueCommentId },
      select: { issue: { select: { projectId: true } } },
    });
    return comment?.issue.projectId ?? null;
  }

  if (attachment.projectCommentId != null) {
    const comment = await prisma.projectComment.findUnique({
      where: { id: attachment.projectCommentId },
      select: { projectId: true },
    });
    return comment?.projectId ?? null;
  }

  return null;
}

export async function assertAttachmentProjectAccess(
  userId: number,
  refs: {
    projectId?: number | null;
    issueId?: number | null;
    issueCommentId?: number | null;
    projectCommentId?: number | null;
  },
  isAdmin = false
): Promise<void> {
  const projectId = await resolveAttachmentProjectId({
    projectId: refs.projectId ?? null,
    issueId: refs.issueId ?? null,
    issueCommentId: refs.issueCommentId ?? null,
    projectCommentId: refs.projectCommentId ?? null,
  });
  if (projectId != null) {
    await assertProjectMember(userId, projectId, isAdmin);
  }
}

export function sendProjectAccessDenied(res: Response): void {
  res.status(403).json({ error: PROJECT_ACCESS_DENIED_MESSAGE });
}

/**
 * If the project has no individual members and no group assignments after a removal,
 * add `userId` with every Role assigned individually.
 */
export async function ensureProjectHasMember(
  tx: any,
  projectId: number,
  userId: number
): Promise<void> {
  const [memberCount, groupCount] = await Promise.all([
    tx.projectMember.count({ where: { projectId } }),
    tx.projectGroup.count({ where: { projectId } }),
  ]);
  if (memberCount + groupCount > 0) return;

  const roles = await tx.role.findMany({ select: { id: true } });
  await tx.projectMember.create({
    data: {
      projectId,
      userId,
      ...(roles.length > 0
        ? { roles: { create: roles.map((r: { id: number }) => ({ roleId: r.id, sourceGroupId: null })) } }
        : {}),
    },
  });
}

/** Middleware: require ProjectMember (or isAdmin) for req.params[paramName]. */
export function requireProjectMember(paramName: string = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = Number(req.params[paramName]);
      const admin = isRequestAdmin(req);
      if (!req.userId || !(await isProjectMember(req.userId, projectId, admin))) {
        sendProjectAccessDenied(res);
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: 'プロジェクト権限の確認に失敗しました' });
    }
  };
}
