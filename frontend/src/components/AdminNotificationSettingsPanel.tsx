import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import api from '../api/client';
import { AdminNotificationSettings, NotificationChannel, User } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface Props {
  user: User;
}

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'email', label: 'メール' },
  { value: 'teams', label: 'Teams' },
  { value: 'off', label: '送信しない' },
];

export default function AdminNotificationSettingsPanel({ user }: Props) {
  const { canInput } = usePermissions(user.permissions);
  const canEdit = canInput('admin.notification-settings');
  const [defaultChannel, setDefaultChannel] = useState<NotificationChannel>('email');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'email' | 'teams' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<AdminNotificationSettings>('/admin/settings/notifications');
      setDefaultChannel(res.data.defaultChannel);
    } catch (err) {
      console.error('Failed to fetch admin notification settings:', err);
      setError('通知設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const res = await api.put<AdminNotificationSettings>('/admin/settings/notifications', {
        defaultChannel,
      });
      setDefaultChannel(res.data.defaultChannel);
      setMessage('通知設定を保存しました');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || '通知設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: 'email' | 'teams') => {
    setMessage('');
    setError('');
    setTesting(channel);
    try {
      const res = await api.post<{ message: string }>('/admin/settings/notifications/test', { channel });
      setMessage(res.data.message || 'テスト通知を送信しました');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; details?: string } } };
      setError(ax.response?.data?.details || ax.response?.data?.error || 'テスト通知の送信に失敗しました');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6 border-b pb-4">
          <Bell className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-800">通知設定</h2>
        </div>
        {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">新規ユーザーの既定配信先</p>
              <div className="space-y-2">
                {CHANNEL_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 text-sm ${!canEdit ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="radio"
                      name="defaultNotificationChannel"
                      checked={defaultChannel === opt.value}
                      onChange={() => setDefaultChannel(opt.value)}
                      disabled={!canEdit}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canEdit || saving}
              className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '設定を保存'}
            </button>
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">テスト送信（自分宛て）</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTest('email')}
                  disabled={!canEdit || testing !== null}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-sky-600 text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                >
                  {testing === 'email' ? '送信中…' : 'テストメール送信'}
                </button>
                <button
                  type="button"
                  onClick={() => handleTest('teams')}
                  disabled={!canEdit || testing !== null || !user.microsoftLinked}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-white border border-sky-600 text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                >
                  {testing === 'teams' ? '送信中…' : 'Teams テスト送信'}
                </button>
              </div>
              {!user.microsoftLinked && (
                <p className="text-xs text-gray-500 mt-2">Teams テストは Microsoft アカウント連携が必要です。</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
