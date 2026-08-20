import { PrismaClient } from '@prisma/client';
import { sendMailMessage } from '../email';
import {
  defaultEnabledFor,
  isNotificationChannel,
  NotificationClientError,
  type NotificationChannel,
  type NotificationEventType,
} from './catalog';
import { isTeamsBotConfigured, sendTeamsBotMessage } from './teamsBot';
import { renderNotification } from './templates';
import { eventTypeOf, resolveRecipientUserIds, type DomainNotification } from './recipients';

const prisma = new PrismaClient();

async function isEventEnabled(userId: number, eventType: NotificationEventType): Promise<boolean> {
  const row = await prisma.userNotificationPreference.findUnique({
    where: { userId_eventType: { userId, eventType } },
  });
  if (!row) return defaultEnabledFor(eventType);
  return row.enabled;
}

function resolveDeliveryChannel(
  channel: string,
  microsoftOid: string | null
): 'email' | 'teams' | 'skip' {
  if (!isNotificationChannel(channel) || channel === 'off') return 'skip';
  if (channel === 'email') return 'email';
  if (microsoftOid && isTeamsBotConfigured()) return 'teams';
  return 'email';
}

async function deliverToUser(params: {
  userId: number;
  eventType: NotificationEventType;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      email: true,
      notificationChannel: true,
      microsoftOid: true,
      status: true,
    },
  });
  if (!user || user.status !== 'active') return;
  if (!(await isEventEnabled(params.userId, params.eventType))) return;

  const via = resolveDeliveryChannel(user.notificationChannel, user.microsoftOid);
  if (via === 'skip') return;

  if (via === 'teams' && user.microsoftOid) {
    try {
      await sendTeamsBotMessage({
        microsoftOid: user.microsoftOid,
        title: params.title,
        preview: params.body.replace(/\s+/g, ' ').slice(0, 150),
        webUrl: params.url,
      });
      return;
    } catch (e) {
      console.error(`Teams notification failed for user ${params.userId}:`, e);
      return;
    }
  }

  try {
    await sendMailMessage({
      to: user.email,
      subject: `[ProjectHub] ${params.title}`,
      text: `${params.body}\n`,
    });
  } catch (e) {
    console.error(`Email notification failed for user ${params.userId}:`, e);
  }
}

export async function deliverNotification(event: DomainNotification): Promise<void> {
  const eventType = eventTypeOf(event);
  const rendered = await renderNotification(event);
  if (!rendered) return;
  const recipientIds = await resolveRecipientUserIds(event);
  for (const userId of recipientIds) {
    await deliverToUser({
      userId,
      eventType,
      title: rendered.title,
      body: rendered.body,
      url: rendered.url,
    });
  }
}

export function scheduleNotify(event: DomainNotification): void {
  setImmediate(() => {
    deliverNotification(event).catch((err) => {
      console.error('Notification failed:', err);
    });
  });
}

export async function sendTestNotification(params: {
  userId: number;
  channel: NotificationChannel;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, microsoftOid: true, firstName: true, lastName: true },
  });
  if (!user) {
    throw new Error('ユーザーが見つかりません');
  }
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
  const title = '通知のテスト送信';
  const body = `これは ProjectHub からのテスト通知です。\n時刻: ${new Date().toISOString()}\n${frontend}/settings`;
  if (params.channel === 'off') {
    throw new NotificationClientError('送信しない はテストできません');
  }
  if (params.channel === 'teams') {
    if (!user.microsoftOid) {
      throw new NotificationClientError('Microsoft アカウントが未連携です');
    }
    if (!isTeamsBotConfigured()) {
      throw new NotificationClientError('Microsoft 連携（Entra）が未設定です');
    }
    await sendTeamsBotMessage({
      microsoftOid: user.microsoftOid,
      title,
      preview: 'これは ProjectHub からのテスト通知です。',
      webUrl: `${frontend}/settings`,
    });
    return;
  }
  await sendMailMessage({
    to: user.email,
    subject: `[ProjectHub] ${title}`,
    text: `${body}\n`,
  });
}
