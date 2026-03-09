import { useState, useEffect } from 'react';
import { User } from '../types';
import api from '../api/client';

interface Props {
  user: User;
  refreshUser: () => Promise<User>;
}

export default function SettingsPage({ user, refreshUser }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [landingMessage, setLandingMessage] = useState('');
  const [landingError, setLandingError] = useState('');
  const [loading, setLoading] = useState(false);

  const [landingPage, setLandingPage] = useState(user.landingPage);

  const [showProjectsMenu, setShowProjectsMenu] = useState(user.showProjectsMenu);
  const [showCompanyMenu, setShowCompanyMenu] = useState(user.showCompanyMenu);
  const [showAdminMenu, setShowAdminMenu] = useState(user.showAdminMenu);
  const [menuSettingMessage, setMenuSettingMessage] = useState('');
  const [menuSettingError, setMenuSettingError] = useState('');

  // Sync state if user prop changes externally
  useEffect(() => {
    setLandingPage(user.landingPage);
    setShowProjectsMenu(user.showProjectsMenu);
    setShowCompanyMenu(user.showCompanyMenu);
    setShowAdminMenu(user.showAdminMenu);
  }, [user]);

  const handleUpdateLandingPage = async () => {
    setLandingMessage('');
    setLandingError('');
    try {
      setLoading(true);
      await api.put('/auth/landing-page', { landingPage });
      await refreshUser();
      setLandingMessage('遷移先の設定を更新しました。');
    } catch (err: any) {
      setLandingError(err.response?.data?.error || '設定の更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMenuSettings = async () => {
    setMenuSettingMessage('');
    setMenuSettingError('');
    try {
      setLoading(true);
      await api.put('/auth/menu-settings', {
        showProjectsMenu,
        showCompanyMenu,
        showAdminMenu
      });
      await refreshUser();
      setMenuSettingMessage('メニュー表示設定を更新しました。');
    } catch (err: any) {
      setMenuSettingError(err.response?.data?.error || 'メニュー表示設定の更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }
    if (newPassword.length < 6) {
      setError('新しいパスワードは6文字以上で入力してください');
      return;
    }

    setLoading(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setMessage('パスワードを変更しました');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'パスワードの変更に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">設定</h1>

      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">アカウント情報</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">名前</dt>
          <dd>{user.lastName} {user.firstName}</dd>
          <dt className="text-gray-500">メールアドレス</dt>
          <dd>{user.email}</dd>
          <dt className="text-gray-500">ロール</dt>
          <dd>{user.role}</dd>
        </dl>
      </div>

      <div className="bg-white rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-4">パスワード変更</h2>
        {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? '変更中...' : 'パスワードを変更'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded shadow p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">遷移先の設定</h2>
        {landingMessage && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{landingMessage}</div>}
        {landingError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{landingError}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ログイン後の遷移先</label>
            <select
              value={landingPage}
              onChange={(e) => setLandingPage(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white"
            >
              <option value="home">ホーム</option>
              <option value="projects">プロジェクト</option>
              <option value="gantt">ガントチャート</option>
              <option value="companies">会社</option>
            </select>
          </div>
          <button
            onClick={handleUpdateLandingPage}
            disabled={loading}
            className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? '更新中...' : '遷移先を保存'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">ヘッダーメニュー表示設定</h2>
        {menuSettingMessage && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{menuSettingMessage}</div>}
        {menuSettingError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{menuSettingError}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center cursor-pointer p-3 border rounded-md hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={showProjectsMenu} onChange={e => setShowProjectsMenu(e.target.checked)} className="mr-3 rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">プロジェクト</span>
            </label>
            <label className="flex items-center cursor-pointer p-3 border rounded-md hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={showCompanyMenu} onChange={e => setShowCompanyMenu(e.target.checked)} className="mr-3 rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">会社</span>
            </label>
            {user.role === 'admin' && (
              <label className="flex items-center cursor-pointer p-3 border rounded-md hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={showAdminMenu} onChange={e => setShowAdminMenu(e.target.checked)} className="mr-3 rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4" />
                <span className="text-sm font-medium text-gray-700">管理</span>
              </label>
            )}
          </div>

          <button
            onClick={handleUpdateMenuSettings}
            disabled={loading}
            className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50 mt-4"
          >
            {loading ? '更新中...' : 'メニュー設定を保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
