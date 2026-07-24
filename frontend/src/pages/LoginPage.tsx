import { useState, FormEvent, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TextInput from '../components/TextInput';

interface Props {
  onLogin: (email: string, password: string) => Promise<any>;
  onSsoLogin: (code: string) => Promise<any>;
}

export default function LoginPage({ onLogin, onSsoLogin }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/auth/microsoft/status')
      .then((res) => res.json())
      .then((data) => setSsoEnabled(Boolean(data?.enabled)))
      .catch(() => setSsoEnabled(false));
  }, []);

  useEffect(() => {
    const ssoError = searchParams.get('ssoError');
    const ssoCode = searchParams.get('ssoCode');
    if (ssoError) {
      setError(ssoError);
      setSearchParams({}, { replace: true });
      return;
    }
    if (!ssoCode) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    onSsoLogin(ssoCode)
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Microsoft ログインに失敗しました');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setSearchParams({}, { replace: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams, onSsoLogin, setSearchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-800">ProjectHub</h1>
        <h2 className="text-lg font-semibold text-center mb-4">ログイン</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <TextInput
              label="メールアドレス"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <TextInput
              label="パスワード"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-sky-600 text-white py-2 rounded-md hover:bg-sky-700 disabled:opacity-50">
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        {ssoEnabled && (
          <div className="mt-4">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-gray-400">または</span>
              </div>
            </div>
            <a
              href="/api/auth/microsoft/start"
              className={`block w-full text-center border border-gray-300 text-slate-700 py-2 rounded-md hover:bg-gray-50 text-sm ${loading ? 'pointer-events-none opacity-50' : ''}`}
            >
              Microsoft でログイン
            </a>
          </div>
        )}

        {!import.meta.env.PROD && (
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-400 text-center mb-3">テストユーザーでログイン</p>
            <button
              onClick={() => { setError(''); setLoading(true); onLogin('admin@example.com', 'admin123').catch((err: any) => { setError(err.response?.data?.error || 'ログインに失敗しました'); }).finally(() => setLoading(false)); }}
              disabled={loading}
              className="w-full bg-slate-700 text-white py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 text-sm"
            >
              管理者 (admin@example.com)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
