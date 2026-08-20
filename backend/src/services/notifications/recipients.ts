import { PrismaClient } from '@prisma/client';
import { getEffectiveMemberUserIds } from '../projectMembership';
import type { NotificationEventType } from './catalog';

const prisma = new PrismaClient();

export type IssueNotifySnapshot = {
  id: number;
  subject: string;
  projectId: number;
  authorId: number;
  assigneeIds: number[];
  assignedToGroupId: number | null;
};

export type DomainNotification =
  | { type: 'issue.created'; actorUserId: number; issueId: number }
  | {
      type: 'issue.assignee_changed';
      actorUserId: number;
      issueId: number;
      addedUserIds: number[];
      removedUserIds: number[];
      addedGroupId: number | null;
      removedGroupId: number | null;
    }
  | {
      type: 'issue.status_changed' | 'issue.commented' | 'issue.updated';
      actorUserId: number;
      issueId: number;
    }
  | { type: 'issue.deleted'; actorUserId: number; snapshot: IssueNotifySnapshot }
  | { type: 'issue.relation_changed'; actorUserId: number; fromIssueId: number; toIssueId: number }
  | { type: 'issue.project_moved'; actorUserId: number; issueId: number; destProjectId: number }
  | { type: 'project.member_added'; actorUserId: number; projectId: number; addedUserId: number }
  | { type: 'project.group_assigned'; actorUserId: number; projectId: number; groupId: number }
  | {
      type:
        | 'project.status_changed'
        | 'project.commented'
        | 'project.created'
        | 'project.due_date_changed'
        | 'project.wiki_changed';
      actorUserId: number;
      projectId: number;
    }
  | { type: 'project.activity_linked'; actorUserId: number; projectId: number; activityId: number }
  | {
      type: 'deal.assignee_changed';
      actorUserId: number;
      dealId: number;
      addedUserId: number | null;
      removedUserId: number | null;
    }
  | { type: 'deal.status_changed'; actorUserId: number; dealId: number }
  | {
      type: 'activity.assignee_changed';
      actorUserId: number;
      activityId: number;
      addedUserId: number | null;
      removedUserId: number | null;
    }
  | { type: 'activity.completed' | 'activity.updated'; actorUserId: number; activityId: number };

async function uniqueActiveUserIds(ids: Iterable<number>, excludeUserId: number): Promise<number[]> {
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0 && id !== excludeUserId);
  if (unique.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: unique }, status: 'active' },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function expandGroup(groupId: number | null | undefined): Promise<number[]> {
  if (groupId == null) return [];
  return getEffectiveMemberUserIds(groupId);
}

export async function getProjectMemberUserIds(projectId: number): Promise<number[]> {
  const [members, groups] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } }),
    prisma.projectGroup.findMany({ where: { projectId }, select: { groupId: true } }),
  ]);
  const ids = new Set(members.map((m) => m.userId));
  for (const g of groups) {
    for (const uid of await expandGroup(g.groupId)) ids.add(uid);
  }
  return [...ids];
}

async function loadIssueSnapshot(issueId: number): Promise<IssueNotifySnapshot | null> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      subject: true,
      projectId: true,
      authorId: true,
      assignedToGroupId: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!issue) return null;
  return {
    id: issue.id,
    subject: issue.subject,
    projectId: issue.projectId,
    authorId: issue.authorId,
    assigneeIds: issue.assignees.map((a) => a.userId),
    assignedToGroupId: issue.assignedToGroupId,
  };
}

async function issuePeopleIds(snapshot: IssueNotifySnapshot): Promise<number[]> {
  const ids = new Set<number>([snapshot.authorId, ...snapshot.assigneeIds]);
  for (const uid of await expandGroup(snapshot.assignedToGroupId)) ids.add(uid);
  return [...ids];
}

export async function resolveRecipientUserIds(event: DomainNotification): Promise<number[]> {
  const actor = event.actorUserId;
  let ids: number[] = [];

  switch (event.type) {
    case 'issue.created': {
      const snap = await loadIssueSnapshot(event.issueId);
      if (!snap) return [];
      ids = [...snap.assigneeIds, ...(await expandGroup(snap.assignedToGroupId))];
      break;
    }
    case 'issue.assignee_changed': {
      const groupIds = new Set<number>();
      if (event.addedGroupId) groupIds.add(event.addedGroupId);
      if (event.removedGroupId) groupIds.add(event.removedGroupId);
      const fromGroups: number[] = [];
      for (const gid of groupIds) fromGroups.push(...(await expandGroup(gid)));
      ids = [...event.addedUserIds, ...event.removedUserIds, ...fromGroups];
      break;
    }
    case 'issue.status_changed':
    case 'issue.commented':
    case 'issue.updated': {
      const snap = await loadIssueSnapshot(event.issueId);
      if (!snap) return [];
      ids = await issuePeopleIds(snap);
      break;
    }
    case 'issue.deleted': {
      ids = await issuePeopleIds(event.snapshot);
      break;
    }
    case 'issue.relation_changed': {
      const [from, to] = await Promise.all([
        loadIssueSnapshot(event.fromIssueId),
        loadIssueSnapshot(event.toIssueId),
      ]);
      const set = new Set<number>();
      if (from) for (const id of await issuePeopleIds(from)) set.add(id);
      if (to) for (const id of await issuePeopleIds(to)) set.add(id);
      ids = [...set];
      break;
    }
    case 'issue.project_moved': {
      const snap = await loadIssueSnapshot(event.issueId);
      const destMembers = await getProjectMemberUserIds(event.destProjectId);
      const set = new Set<number>(destMembers);
      if (snap) {
        for (const id of snap.assigneeIds) set.add(id);
        for (const id of await expandGroup(snap.assignedToGroupId)) set.add(id);
      }
      ids = [...set];
      break;
    }
    case 'project.member_added':
      ids = [event.addedUserId];
      break;
    case 'project.group_assigned':
      ids = await expandGroup(event.groupId);
      break;
    case 'project.status_changed':
    case 'project.commented':
    case 'project.created':
    case 'project.due_date_changed':
    case 'project.wiki_changed':
      ids = await getProjectMemberUserIds(event.projectId);
      break;
    case 'project.activity_linked': {
      const activity = await prisma.activity.findUnique({
        where: { id: event.activityId },
        select: { assignedToId: true },
      });
      const members = await getProjectMemberUserIds(event.projectId);
      ids = [...members];
      if (activity?.assignedToId) ids.push(activity.assignedToId);
      break;
    }
    case 'deal.assignee_changed':
      ids = [event.addedUserId, event.removedUserId].filter((id): id is number => id != null);
      break;
    case 'deal.status_changed': {
      const deal = await prisma.deal.findUnique({
        where: { id: event.dealId },
        select: { assignedToId: true },
      });
      ids = deal?.assignedToId != null ? [deal.assignedToId] : [];
      break;
    }
    case 'activity.assignee_changed':
      ids = [event.addedUserId, event.removedUserId].filter((id): id is number => id != null);
      break;
    case 'activity.completed':
    case 'activity.updated': {
      const activity = await prisma.activity.findUnique({
        where: { id: event.activityId },
        select: { assignedToId: true },
      });
      ids = activity?.assignedToId != null ? [activity.assignedToId] : [];
      break;
    }
    default:
      ids = [];
  }

  return uniqueActiveUserIds(ids, actor);
}

export function eventTypeOf(event: DomainNotification): NotificationEventType {
  return event.type;
}
