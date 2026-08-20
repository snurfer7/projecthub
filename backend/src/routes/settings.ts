import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { hasPermission, resolveUserPermissions } from '../services/permissions';
import { getOrCreateSystemSetting, workCalendarDto } from '../services/systemCalendar';
import {
  NOTIFICATION_EVENT_TYPES,
  isNotificationChannel,
  isNotificationEventType,
  isNotificationEventVisible,
} from '../services/notifications';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

/** 営業時間・休日の参照専用（認証のみ） */
router.get('/calendar', async (_req: AuthRequest, res: Response) => {
  try {
    const setting = await getOrCreateSystemSetting(prisma);
    res.json(workCalendarDto(setting));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error fetching work calendar:', e);
    res.status(500).json({ error: 'カレンダー設定の取得に失敗しました', details: message });
  }
});

async function notificationSettingsDto(userId: number) {
  const [user, prefs, permissions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { notificationChannel: true, microsoftOid: true },
    }),
    prisma.userNotificationPreference.findMany({ where: { userId } }),
    resolveUserPermissions(userId),
  ]);
  const canUse = (code: string) => hasPermission(permissions, code, 'use');
  const prefMap = new Map(prefs.map((p) => [p.eventType, p.enabled]));
  return {
    channel: isNotificationChannel(user?.notificationChannel) ? user!.notificationChannel : 'email',
    microsoftLinked: Boolean(user?.microsoftOid),
    events: NOTIFICATION_EVENT_TYPES.filter((e) => isNotificationEventVisible(e.type, canUse)).map((e) => ({
      type: e.type,
      group: e.group,
      name: e.name,
      enabled: prefMap.has(e.type) ? Boolean(prefMap.get(e.type)) : e.defaultEnabled,
      defaultEnabled: e.defaultEnabled,
    })),
  };
}

router.get(
  '/notifications',
  requirePermission('settings', 'use'),
  async (req: AuthRequest, res: Response) => {
    try {
      res.json(await notificationSettingsDto(req.userId!));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Error fetching notification settings:', e);
      res.status(500).json({ error: '通知設定の取得に失敗しました', details: message });
    }
  }
);

router.put(
  '/notifications',
  requirePermission('settings', 'use'),
  async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await resolveUserPermissions(req.userId!);
      const canUse = (code: string) => hasPermission(permissions, code, 'use');

      const { channel, events } = req.body as {
        channel?: unknown;
        events?: unknown;
      };

      if (channel !== undefined) {
        if (!isNotificationChannel(channel)) {
          res.status(400).json({ error: 'channel は email, teams, off のいずれかです' });
          return;
        }
        await prisma.user.update({
          where: { id: req.userId! },
          data: { notificationChannel: channel },
        });
      }

      if (events !== undefined) {
        if (!Array.isArray(events)) {
          res.status(400).json({ error: 'events は配列である必要があります' });
          return;
        }
        for (const item of events) {
          if (!item || typeof item !== 'object') {
            res.status(400).json({ error: 'events の各要素はオブジェクトである必要があります' });
            return;
          }
          const type = (item as { type?: unknown }).type;
          const enabled = (item as { enabled?: unknown }).enabled;
          if (!isNotificationEventType(type)) {
            res.status(400).json({ error: `未知のイベント種別です: ${String(type)}` });
            return;
          }
          if (!isNotificationEventVisible(type, canUse)) {
            continue;
          }
          if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled は boolean である必要があります' });
            return;
          }
          await prisma.userNotificationPreference.upsert({
            where: { userId_eventType: { userId: req.userId!, eventType: type } },
            update: { enabled },
            create: { userId: req.userId!, eventType: type, enabled },
          });
        }
      }

      res.json(await notificationSettingsDto(req.userId!));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Error updating notification settings:', e);
      res.status(500).json({ error: '通知設定の更新に失敗しました', details: message });
    }
  }
);

export default router;
