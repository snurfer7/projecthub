import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User } from '../types';
import api from '../api/client';
import Combobox from '../components/Combobox';
import TextInput from '../components/TextInput';
import { usePermissions } from '../hooks/usePermissions';

interface Props {
  user: User;
  refreshUser: () => Promise<User>;
}

export default function SettingsPage({ user, refreshUser }: Props) {
  const { canInput } = usePermissions(user.permissions);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [landingMessage, setLandingMessage] = useState('');
  const [landingError, setLandingError] = useState('');
  const [loading, setLoading] = useState(false);

  const [landingPage, setLandingPage] = useState(
    () => (user.landingPage === 'gantt' ? 'projects' : user.landingPage)
  );

  const [showProjectsMenu, setShowProjectsMenu] = useState(user.showProjectsMenu);
  const [showCompanyMenu, setShowCompanyMenu] = useState(user.showCompanyMenu);
  const [menuSettingMessage, setMenuSettingMessage] = useState('');
  const [menuSettingError, setMenuSettingError] = useState('');

  const [authMethod, setAuthMethod] = useState<'password' | 'sso'>(user.authMethod === 'sso' ? 'sso' : 'password');
  const [authMethodPassword, setAuthMethodPassword] = useState('');
  const [authMethodMessage, setAuthMethodMessage] = useState('');
  const [authMethodError, setAuthMethodError] = useState('');
  const [microsoftMessage, setMicrosoftMessage] = useState('');
  const [microsoftError, setMicrosoftError] = useState('');
  const [ssoConfigured, setSsoConfigured] = useState(false);

  const canEditAuthMethod = canInput('settings.fields.authMethod');
  const canEditMicrosoft = canInput('settings.fields.microsoftAccount');
  const isSso = (user.authMethod ?? 'password') === 'sso';
  const microsoftLinked = Boolean(user.microsoftLinked);

  useEffect(() => {
    setLandingPage(user.landingPage === 'gantt' ? 'projects' : user.landingPage);
    setShowProjectsMenu(user.showProjectsMenu);
    setShowCompanyMenu(user.showCompanyMenu);
    setAuthMethod(user.authMethod === 'sso' ? 'sso' : 'password');
  }, [user]);

  useEffect(() => {
    fetch('/api/auth/microsoft/status')
      .then((res) => res.json())
      .then((data) => setSsoConfigured(Boolean(data?.enabled)))
      .catch(() => setSsoConfigured(false));
  }, []);

  useEffect(() => {
    const linked = searchParams.get('microsoftLinked');
    const linkError = searchParams.get('microsoftLinkError');
    if (linked === '1') {
      setMicrosoftMessage('Microsoft アカウントを連携しました');
      setMicrosoftError('');
      refreshUser().catch(() => {});
      setSearchParams({}, { replace: true });
    } else if (linkError) {
      setMicrosoftError(linkError);
      setMicrosoftMessage('');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshUser]);

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
        showCompanyMenu
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

  const handleSaveAuthMethod = async () => {
    setAuthMethodMessage('');
    setAuthMethodError('');
    setLoading(true);
    try {
      const body: { authMethod: 'password' | 'sso'; newPassword?: string } = { authMethod };
      if (authMethod === 'password') {
        body.newPassword = authMethodPassword;
      }
      await api.put('/auth/auth-method', body);
      await refreshUser();
      setAuthMethodPassword('');
      setAuthMethodMessage(
        authMethod === 'sso'
          ? '認証方式を Microsoft SSO に変更しました'
          : '認証方式をパスワードに変更しました'
      );
    } catch (err: any) {
      setAuthMethodError(err.response?.data?.error || '認証方式の更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkMicrosoft = async () => {
    setMicrosoftMessage('');
    setMicrosoftError('');
    setLoading(true);
    try {
      const res = await api.get<{ authorizationUrl: string }>('/auth/microsoft/link/start');
      window.location.href = res.data.authorizationUrl;
    } catch (err: any) {
      setMicrosoftError(err.response?.data?.error || 'Microsoft 連携の開始に失敗しました');
      setLoading(false);
    }
  };

  const handleUnlinkMicrosoft = async () => {
    setMicrosoftMessage('');
    setMicrosoftError('');
    setLoading(true);
    try {
      await api.post('/auth/microsoft/unlink');
      await refreshUser();
      setMicrosoftMessage('Microsoft アカウントの連携を解除しました');
    } catch (err: any) {
      setMicrosoftError(err.response?.data?.error || '連携解除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-full">
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
          <dt className="text-gray-500">認証方式</dt>
          <dd>{isSso ? 'Microsoft SSO' : 'パスワード'}</dd>
        </dl>
      </div>

      {ssoConfigured && (
        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Microsoft アカウント連携</h2>
          {microsoftMessage && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{microsoftMessage}</div>}
          {microsoftError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{microsoftError}</div>}
          <p className="text-sm text-gray-600 mb-4">
            連携状態: {microsoftLinked ? '連携済み' : '未連携'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            ProjectHub のメールと Microsoft のメールが一致しない場合も、ここで明示連携できます。SSO ログインには連携（またはメール一致）と認証方式「Microsoft SSO」が必要です。
          </p>
          <div className="flex flex-wrap gap-2">
            {!microsoftLinked ? (
              <button
                type="button"
                onClick={handleLinkMicrosoft}
                disabled={loading || !canEditMicrosoft}
                className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
              >
                Microsoft アカウントを連携
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUnlinkMicrosoft}
                disabled={loading || !canEditMicrosoft || isSso}
                className="bg-white border border-gray-300 text-slate-700 px-4 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                連携を解除
              </button>
            )}
          </div>
          {isSso && microsoftLinked && (
            <p className="mt-3 text-xs text-gray-500">SSO 利用中は連携を解除できません。先に認証方式をパスワードに戻してください。</p>
          )}
        </div>
      )}

      {ssoConfigured && (
        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">認証方式</h2>
          {authMethodMessage && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{authMethodMessage}</div>}
          {authMethodError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{authMethodError}</div>}
          <div className="space-y-4">
            <label className={`flex items-center gap-2 text-sm ${!canEditAuthMethod ? 'opacity-50' : ''}`}>
              <input
                type="radio"
                name="authMethod"
                checked={authMethod === 'password'}
                onChange={() => setAuthMethod('password')}
                disabled={!canEditAuthMethod}
              />
              パスワードのみ
            </label>
            <label className={`flex items-center gap-2 text-sm ${!canEditAuthMethod ? 'opacity-50' : ''}`}>
              <input
                type="radio"
                name="authMethod"
                checked={authMethod === 'sso'}
                onChange={() => setAuthMethod('sso')}
                disabled={!canEditAuthMethod || !microsoftLinked}
              />
              Microsoft SSO のみ
            </label>
            {!microsoftLinked && (
              <p className="text-xs text-gray-500">SSO に切り替えるには、先に Microsoft アカウントを連携してください。</p>
            )}
            {authMethod === 'password' && user.authMethod === 'sso' && (
              <TextInput
                label="新しいパスワード（パスワード認証に戻す場合）"
                type="password"
                value={authMethodPassword}
                onChange={(e) => setAuthMethodPassword(e.target.value)}
                disabled={!canEditAuthMethod}
                required
              />
            )}
            <button
              type="button"
              onClick={handleSaveAuthMethod}
              disabled={
                loading ||
                !canEditAuthMethod ||
                authMethod === (user.authMethod ?? 'password') ||
                (authMethod === 'password' && user.authMethod === 'sso' && authMethodPassword.length < 6) ||
                (authMethod === 'sso' && !microsoftLinked)
              }
              className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? '更新中...' : '認証方式を保存'}
            </button>
          </div>
        </div>
      )}

      {!isSso && (
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">パスワード変更</h2>
          {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{message}</div>}
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextInput
              label="現在のパスワード"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
            <TextInput
              label="新しいパスワード"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
            <TextInput
              label="新しいパスワード（確認）"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? '変更中...' : 'パスワードを変更'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded shadow p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">遷移先の設定</h2>
        {landingMessage && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{landingMessage}</div>}
        {landingError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{landingError}</div>}
        <div className="space-y-4">
          <div>
            <Combobox
              label="ログイン後の遷移先"
              options={[
                { value: 'home', label: 'ホーム' },
                { value: 'projects', label: 'プロジェクト' },
                { value: 'companies', label: '企業' },
              ]}
              value={landingPage}
              onChange={setLandingPage}
              size="medium"
            />
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
              <span className="text-sm font-medium text-gray-700">企業</span>
            </label>
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
