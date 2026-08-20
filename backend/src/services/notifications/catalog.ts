export const NOTIFICATION_CHANNELS = ['email', 'teams', 'off'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENT_GROUPS = ['issue', 'project', 'deal', 'activity'] as const;
export type NotificationEventGroup = (typeof NOTIFICATION_EVENT_GROUPS)[number];

export const NOTIFICATION_EVENT_TYPES = [
  { type: 'issue.created', group: 'issue', name: '作成', defaultEnabled: true },
  { type: 'issue.assignee_changed', group: 'issue', name: '担当者変更', defaultEnabled: true },
  { type: 'issue.status_changed', group: 'issue', name: 'ステータス変更', defaultEnabled: true },
  { type: 'issue.commented', group: 'issue', name: 'コメント追加', defaultEnabled: true },
  { type: 'issue.deleted', group: 'issue', name: '削除', defaultEnabled: true },
  { type: 'issue.updated', group: 'issue', name: 'その他の更新', defaultEnabled: false },
  { type: 'issue.relation_changed', group: 'issue', name: '関連の追加・解除', defaultEnabled: false },
  { type: 'issue.project_moved', group: 'issue', name: 'プロジェクト移動', defaultEnabled: false },
  { type: 'project.member_added', group: 'project', name: 'メンバー追加', defaultEnabled: true },
  { type: 'project.group_assigned', group: 'project', name: 'グループ割当', defaultEnabled: true },
  { type: 'project.status_changed', group: 'project', name: 'ステータス変更', defaultEnabled: true },
  { type: 'project.commented', group: 'project', name: 'コメント追加', defaultEnabled: true },
  { type: 'project.created', group: 'project', name: '作成', defaultEnabled: false },
  { type: 'project.due_date_changed', group: 'project', name: '期日変更', defaultEnabled: false },
  { type: 'project.wiki_changed', group: 'project', name: 'Wiki 作成・更新', defaultEnabled: false },
  { type: 'project.activity_linked', group: 'project', name: '活動の紐づけ', defaultEnabled: false },
  { type: 'deal.assignee_changed', group: 'deal', name: '担当者の設定・変更', defaultEnabled: true },
  { type: 'deal.status_changed', group: 'deal', name: 'ステータス変更', defaultEnabled: true },
  { type: 'activity.assignee_changed', group: 'activity', name: '担当者の設定・変更', defaultEnabled: true },
  { type: 'activity.completed', group: 'activity', name: '完了', defaultEnabled: true },
  { type: 'activity.updated', group: 'activity', name: '作成・更新（担当以外）', defaultEnabled: false },
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number]['type'];

/** 設定画面の種別表示に使うグループ権限（OR）。ロール権限は設定画面では見ない。 */
export const NOTIFICATION_GROUP_PERMISSIONS: Record<NotificationEventGroup, readonly string[]> = {
  issue: ['projects'],
  project: ['projects'],
  deal: ['companies.deals', 'deals'],
  activity: ['companies.activities'],
};

const EVENT_BY_TYPE = new Map(NOTIFICATION_EVENT_TYPES.map((e) => [e.type, e]));

export function isNotificationChannel(value: unknown): value is NotificationChannel {
  return typeof value === 'string' && (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

export function isNotificationEventType(value: unknown): value is NotificationEventType {
  return typeof value === 'string' && EVENT_BY_TYPE.has(value as NotificationEventType);
}

export function getNotificationEventDef(type: string) {
  return EVENT_BY_TYPE.get(type as NotificationEventType);
}

export function isNotificationEventVisible(type: string, canUse: (code: string) => boolean): boolean {
  const def = EVENT_BY_TYPE.get(type as NotificationEventType);
  if (!def) return false;
  return NOTIFICATION_GROUP_PERMISSIONS[def.group].some((code) => canUse(code));
}

export function defaultEnabledFor(type: string): boolean {
  return EVENT_BY_TYPE.get(type as NotificationEventType)?.defaultEnabled ?? false;
}

export class NotificationClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationClientError';
  }
}
