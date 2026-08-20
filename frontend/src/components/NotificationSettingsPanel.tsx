import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { NotificationChannel, NotificationEventGroup, User, UserNotificationSettings } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface Props {
  user: User;
}

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'email', label: 'メール' },
  { value: 'teams', label: 'Teams' },
  { value: 'off', label: '送信しない' },
];

const GROUP_LABELS: Record<NotificationEventGroup, string> = {
  issue: 'チケット',
  project: 'プロジェクト',
  deal: '商談',
  activity: '活動履歴',
};

/** バックエンド catalog の NOTIFICATION_GROUP_PERMISSIONS と揃える（グループ権限の OR） */
const GROUP_PERMISSIONS: Record<NotificationEventGroup, string[]> = {
  issue: ['projects'],
  project: ['projects'],
  deal: ['companies.deals', 'deals'],
  activity: ['companies.activities'],
};

export default function NotificationSettingsPanel({ user }: Props) {
  const { canUse } = usePermissions(user.permissions);
  const [channel, setChannel] = useState<NotificationChannel>('email');
  const [microsoftLinked, setMicrosoftLinked] = useState(Boolean(user.microsoftLinked));
  const [events, setEvents] = useState<UserNotificationSettings['events']>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<UserNotificationSettings>('/settings/notifications');
      setChannel(res.data.channel);
      setMicrosoftLinked(res.data.microsoftLinked);
      setEvents(res.data.events);
    } catch (err) {
      console.error('Failed to fetch notification settings:', err);
      setError('通知設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const visible = (group: NotificationEventGroup) =>
      GROUP_PERMISSIONS[group].some((code) => canUse(code));
    const map = new Map<NotificationEventGroup, UserNotificationSettings['events']>();
    for (const ev of events) {
      if (!visible(ev.group)) continue;
      const list = map.get(ev.group) ?? [];
      list.push(ev);
      map.set(ev.group, list);
    }
    return (['issue', 'project', 'deal', 'activity'] as NotificationEventGroup[])
      .filter((group) => visible(group))
      .map((group) => ({ group, items: map.get(group) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [events, canUse]);

  const handleSave = async () => {
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const visibleTypes = new Set(grouped.flatMap((g) => g.items.map((e) => e.type)));
      const res = await api.put<UserNotificationSettings>('/settings/notifications', {
        channel,
        events: events
          .filter((e) => visibleTypes.has(e.type))
          .map((e) => ({ type: e.type, enabled: e.enabled })),
      });
      setChannel(res.data.channel);
      setMicrosoftLinked(res.data.microsoftLinked);
      setEvents(res.data.events);
      setMessage('通知設定を保存しました');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || '通知設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (type: string, enabled: boolean) => {
    setEvents((prev) => prev.map((e) => (e.type === type ? { ...e, enabled } : e)));
  };

  return (
    <div className="bg-white rounded shadow p-6 mt-6">
      <h2 className="text-lg font-semibold mb-4">通知</h2>
      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{message}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">配信先</p>
            <div className="space-y-2">
              {CHANNEL_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="notificationChannel"
                    checked={channel === opt.value}
                    onChange={() => setChannel(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {channel === 'teams' && !microsoftLinked && (
              <p className="text-xs text-amber-700 mt-2">
                Microsoft アカウント未連携のため、連携するまでメールで送ります。
              </p>
            )}
          </div>

          {grouped.map(({ group, items }) => (
            <div key={group}>
              <p className="text-sm font-medium text-gray-700 mb-2">{GROUP_LABELS[group]}</p>
              <div className="space-y-2">
                {items.map((ev) => (
                  <label key={ev.type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ev.enabled}
                      onChange={(e) => toggleEvent(ev.type, e.target.checked)}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    {ev.name}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '通知設定を保存'}
          </button>
        </div>
      )}
    </div>
  );
}
