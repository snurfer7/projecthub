import { Prisma, PrismaClient } from '@prisma/client';
import {
  getAncestorGroupIds,
  getGroupSubtreeIds,
  type GroupHierarchyEdge,
} from '../utils/groupHierarchy';

const prisma = new PrismaClient();

type Tx = Prisma.TransactionClient | PrismaClient;

let hierarchyCache: GroupHierarchyEdge[] | null = null;
let hierarchyCacheExpiresAt = 0;
const HIERARCHY_TTL_MS = 30_000;

async function loadHierarchyEdges(db: Tx = prisma): Promise<GroupHierarchyEdge[]> {
  const now = Date.now();
  if (db === prisma && hierarchyCache && hierarchyCacheExpiresAt > now) {
    return hierarchyCache;
  }
  const edges = await db.groupHierarchy.findMany({
    select: { parentGroupId: true, childGroupId: true },
  });
  if (db === prisma) {
    hierarchyCache = edges;
    hierarchyCacheExpiresAt = now + HIERARCHY_TTL_MS;
  }
  return edges;
}

export function clearProjectMembershipCache(): void {
  hierarchyCache = null;
  hierarchyCacheExpiresAt = 0;
}

/** Direct group IDs the user belongs to. */
export async function getUserDirectGroupIds(userId: number, db: Tx = prisma): Promise<number[]> {
  const rows = await db.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return rows.map((r) => r.groupId);
}

/**
 * Group IDs that grant the user access when assigned to a project:
 * direct memberships plus all ancestors (parent group assignment covers child members).
 */
export async function getUserCoverageGroupIds(userId: number, db: Tx = prisma): Promise<number[]> {
  const direct = await getUserDirectGroupIds(userId, db);
  if (direct.length === 0) return [];
  const edges = await loadHierarchyEdges(db);
  const coverage = new Set<number>(direct);
  for (const groupId of direct) {
    for (const ancestorId of getAncestorGroupIds(edges, groupId)) {
      coverage.add(ancestorId);
    }
  }
  return [...coverage];
}

/** Effective member user IDs for an assigned group (group + descendant memberships). */
export async function getEffectiveMemberUserIds(groupId: number, db: Tx = prisma): Promise<number[]> {
  const edges = await loadHierarchyEdges(db);
  const subtreeIds = getGroupSubtreeIds(edges, groupId);
  const rows = await db.groupMember.findMany({
    where: { groupId: { in: subtreeIds } },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}

/** Role IDs the user holds on a project (individual + matching ProjectGroup.roleIds). */
export async function getUserRoleIdsOnProject(
  userId: number,
  projectId: number,
  db: Tx = prisma
): Promise<number[]> {
  const map = await getUserRoleIdsOnProjects(userId, [projectId], db);
  return map.get(projectId) ?? [];
}

/** Role IDs per project for a user (batched; one coverage + membership query). */
export async function getUserRoleIdsOnProjects(
  userId: number,
  projectIds: number[],
  db: Tx = prisma
): Promise<Map<number, number[]>> {
  const unique = [...new Set(projectIds.filter((id) => Number.isFinite(id) && id > 0))];
  const result = new Map<number, number[]>();
  if (unique.length === 0) return result;

  const [members, projectGroups, coverage] = await Promise.all([
    db.projectMember.findMany({
      where: { userId, projectId: { in: unique } },
      select: { projectId: true, roles: { select: { roleId: true, sourceGroupId: true } } },
    }),
    db.projectGroup.findMany({
      where: { projectId: { in: unique } },
      select: { projectId: true, groupId: true, roleIds: true },
    }),
    getUserCoverageGroupIds(userId, db),
  ]);

  const coverageSet = new Set(coverage);
  const roleSets = new Map<number, Set<number>>();
  for (const id of unique) roleSets.set(id, new Set());

  for (const member of members) {
    const set = roleSets.get(member.projectId);
    if (!set) continue;
    for (const r of member.roles) {
      // Prefer individual roles; legacy sourceGroup rows still count until cleaned
      set.add(r.roleId);
    }
  }
  for (const pg of projectGroups) {
    if (!coverageSet.has(pg.groupId)) continue;
    const set = roleSets.get(pg.projectId);
    if (!set) continue;
    for (const roleId of pg.roleIds ?? []) {
      set.add(roleId);
    }
  }

  for (const [projectId, set] of roleSets) {
    result.set(projectId, [...set]);
  }
  return result;
}

export async function userHasProjectAccess(
  userId: number,
  projectId: number,
  db: Tx = prisma
): Promise<boolean> {
  const individual = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (individual) return true;

  const coverage = await getUserCoverageGroupIds(userId, db);
  if (coverage.length === 0) return false;

  const hit = await db.projectGroup.findFirst({
    where: { projectId, groupId: { in: coverage } },
    select: { id: true },
  });
  return hit != null;
}

/** Prisma where for listing projects the user can see (non-admin). */
export async function projectAccessWhereForUser(
  userId: number,
  db: Tx = prisma
): Promise<Record<string, unknown>> {
  const coverage = await getUserCoverageGroupIds(userId, db);
  if (coverage.length === 0) {
    return { members: { some: { userId } } };
  }
  return {
    OR: [
      { members: { some: { userId } } },
      { groups: { some: { groupId: { in: coverage } } } },
    ],
  };
}

export async function getAccessibleProjectIdsForUser(
  userId: number,
  db: Tx = prisma
): Promise<number[]> {
  const where = await projectAccessWhereForUser(userId, db);
  const projects = await db.project.findMany({
    where,
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

/** Effective userIds for list filtering (individual ∪ expanded group members). */
export async function getProjectEffectiveMemberUserIds(
  projectId: number,
  db: Tx = prisma
): Promise<number[]> {
  const map = await getProjectsEffectiveMemberUserIds([projectId], db);
  return map.get(projectId) ?? [];
}

/** Batch version for project list responses. */
export async function getProjectsEffectiveMemberUserIds(
  projectIds: number[],
  db: Tx = prisma
): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  if (projectIds.length === 0) return result;

  const [members, groups, edges] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, userId: true },
    }),
    db.projectGroup.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, groupId: true },
    }),
    loadHierarchyEdges(db),
  ]);

  const byProject = new Map<number, Set<number>>();
  for (const id of projectIds) byProject.set(id, new Set());
  for (const m of members) {
    byProject.get(m.projectId)?.add(m.userId);
  }

  const assignedGroupIds = [...new Set(groups.map((g) => g.groupId))];
  const subtreeByAssigned = new Map<number, number[]>();
  const allSubtreeIds = new Set<number>();
  for (const groupId of assignedGroupIds) {
    const subtree = getGroupSubtreeIds(edges, groupId);
    subtreeByAssigned.set(groupId, subtree);
    for (const id of subtree) allSubtreeIds.add(id);
  }

  const groupMembers =
    allSubtreeIds.size === 0
      ? []
      : await db.groupMember.findMany({
          where: { groupId: { in: [...allSubtreeIds] } },
          select: { groupId: true, userId: true },
        });
  const usersByGroup = new Map<number, number[]>();
  for (const gm of groupMembers) {
    const list = usersByGroup.get(gm.groupId) ?? [];
    list.push(gm.userId);
    usersByGroup.set(gm.groupId, list);
  }

  const effectiveByAssigned = new Map<number, number[]>();
  for (const [groupId, subtree] of subtreeByAssigned) {
    const users = new Set<number>();
    for (const gid of subtree) {
      for (const uid of usersByGroup.get(gid) ?? []) users.add(uid);
    }
    effectiveByAssigned.set(groupId, [...users]);
  }

  for (const pg of groups) {
    const set = byProject.get(pg.projectId);
    if (!set) continue;
    for (const uid of effectiveByAssigned.get(pg.groupId) ?? []) set.add(uid);
  }

  for (const [projectId, set] of byProject) {
    result.set(projectId, [...set]);
  }
  return result;
}

const userSelect = { id: true, firstName: true, lastName: true, email: true } as const;

/** Shape group.members as effective members for API responses. */
export async function expandProjectGroupMembers(
  groupId: number,
  db: Tx = prisma
): Promise<{ userId: number; user: { id: number; firstName: string; lastName: string; email: string | null } }[]> {
  const userIds = await getEffectiveMemberUserIds(groupId, db);
  if (userIds.length === 0) return [];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: userSelect,
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return userIds
    .map((userId) => {
      const user = byId.get(userId);
      if (!user) return null;
      return { userId, user };
    })
    .filter((m): m is NonNullable<typeof m> => m != null)
    .sort((a, b) =>
      `${a.user.lastName} ${a.user.firstName}`.localeCompare(
        `${b.user.lastName} ${b.user.firstName}`,
        'ja'
      )
    );
}
