import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  onLogin: (email: string, password: string) => Promise<any>;
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-sky-600 text-white py-2 rounded-md hover:bg-sky-700 disabled:opacity-50">
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          アカウントをお持ちでない方は <Link to="/register" className="text-sky-600 hover:underline">新規登録</Link>
        </p>

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
      </div>
    </div>
  );
}
