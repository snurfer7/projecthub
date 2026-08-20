import { PrismaClient } from '@prisma/client';
import type { DomainNotification, IssueNotifySnapshot } from './recipients';

const prisma = new PrismaClient();

function frontendBase(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
}

function issueUrl(id: number): string {
  return `${frontendBase()}/issues/${id}`;
}

function projectUrl(id: number): string {
  return `${frontendBase()}/projects/${id}`;
}

function companyTabUrl(companyId: number, tab: string, extra?: string): string {
  const q = extra ? `&${extra}` : '';
  return `${frontendBase()}/companies/${companyId}?tab=${tab}${q}`;
}

export type RenderedNotification = {
  title: string;
  body: string;
  url: string;
};

function actorLabel(firstName: string, lastName: string): string {
  return `${lastName} ${firstName}`.trim() || 'ユーザー';
}

async function loadActorName(userId: number): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  return u ? actorLabel(u.firstName, u.lastName) : 'ユーザー';
}

async function loadIssueLine(issueId: number): Promise<{ subject: string; url: string } | null> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, subject: true },
  });
  if (!issue) return null;
  return { subject: `#${issue.id} ${issue.subject}`, url: issueUrl(issue.id) };
}

function snapshotLine(snapshot: IssueNotifySnapshot): { subject: string; url: string } {
  return { subject: `#${snapshot.id} ${snapshot.subject}`, url: issueUrl(snapshot.id) };
}

async function loadProjectName(projectId: number): Promise<{ name: string; url: string } | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!p) return null;
  return { name: p.name, url: projectUrl(p.id) };
}

export async function renderNotification(event: DomainNotification): Promise<RenderedNotification | null> {
  const actor = await loadActorName(event.actorUserId);

  switch (event.type) {
    case 'issue.created':
    case 'issue.assignee_changed':
    case 'issue.status_changed':
    case 'issue.commented':
    case 'issue.updated':
    case 'issue.project_moved': {
      const line = await loadIssueLine(event.issueId);
      if (!line) return null;
      const titles: Record<string, string> = {
        'issue.created': 'チケットが作成されました',
        'issue.assignee_changed': 'チケットの担当者が変更されました',
        'issue.status_changed': 'チケットのステータスが変更されました',
        'issue.commented': 'チケットにコメントが追加されました',
        'issue.updated': 'チケットが更新されました',
        'issue.project_moved': 'チケットのプロジェクトが変更されました',
      };
      return {
        title: titles[event.type],
        body: `${actor} が「${line.subject}」を操作しました。\n${line.url}`,
        url: line.url,
      };
    }
    case 'issue.deleted': {
      const line = snapshotLine(event.snapshot);
      return {
        title: 'チケットが削除されました',
        body: `${actor} が「${line.subject}」を削除しました。`,
        url: projectUrl(event.snapshot.projectId),
      };
    }
    case 'issue.relation_changed': {
      const line = await loadIssueLine(event.fromIssueId);
      if (!line) return null;
      return {
        title: 'チケットの関連が変更されました',
        body: `${actor} が「${line.subject}」の関連を変更しました。\n${line.url}`,
        url: line.url,
      };
    }
    case 'project.member_added':
    case 'project.group_assigned':
    case 'project.status_changed':
    case 'project.commented':
    case 'project.created':
    case 'project.due_date_changed':
    case 'project.wiki_changed':
    case 'project.activity_linked': {
      const p = await loadProjectName(event.projectId);
      if (!p) return null;
      const titles: Record<string, string> = {
        'project.member_added': 'プロジェクトにメンバーが追加されました',
        'project.group_assigned': 'プロジェクトにグループが割り当てられました',
        'project.status_changed': 'プロジェクトのステータスが変更されました',
        'project.commented': 'プロジェクトにコメントが追加されました',
        'project.created': 'プロジェクトが作成されました',
        'project.due_date_changed': 'プロジェクトの期日が変更されました',
        'project.wiki_changed': 'プロジェクト Wiki が更新されました',
        'project.activity_linked': 'プロジェクトに活動が紐づきました',
      };
      return {
        title: titles[event.type],
        body: `${actor} がプロジェクト「${p.name}」を操作しました。\n${p.url}`,
        url: p.url,
      };
    }
    case 'deal.assignee_changed':
    case 'deal.status_changed': {
      const deal = await prisma.deal.findUnique({
        where: { id: event.dealId },
        select: { id: true, name: true, companyId: true },
      });
      if (!deal) return null;
      const url = companyTabUrl(deal.companyId, 'deals');
      const title =
        event.type === 'deal.assignee_changed'
          ? '商談の担当者が変更されました'
          : '商談のステータスが変更されました';
      return {
        title,
        body: `${actor} が商談「${deal.name}」を操作しました。\n${url}`,
        url,
      };
    }
    case 'activity.assignee_changed':
    case 'activity.completed':
    case 'activity.updated': {
      const activity = await prisma.activity.findUnique({
        where: { id: event.activityId },
        select: { id: true, subject: true, companyId: true },
      });
      if (!activity) return null;
      const url = companyTabUrl(activity.companyId, 'activities', `activity=${activity.id}`);
      const titles: Record<string, string> = {
        'activity.assignee_changed': '活動の担当者が変更されました',
        'activity.completed': '活動が完了になりました',
        'activity.updated': '活動が更新されました',
      };
      return {
        title: titles[event.type],
        body: `${actor} が活動「${activity.subject}」を操作しました。\n${url}`,
        url,
      };
    }
    default:
      return null;
  }
}
