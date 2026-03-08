import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  onRegister: (email: string, password: string, firstName: string, lastName: string) => Promise<any>;
}

export default function RegisterPage({ onRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onRegister(email, password, firstName, lastName);
    } catch (err: any) {
      setError(err.response?.data?.error || '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-800">ProjectHub</h1>
        <h2 className="text-lg font-semibold text-center mb-4">新規登録</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-sky-600 text-white py-2 rounded-md hover:bg-sky-700 disabled:opacity-50">
            {loading ? '登録中...' : '登録'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          既にアカウントをお持ちの方は <Link to="/login" className="text-sky-600 hover:underline">ログイン</Link>
        </p>
      </div>
    </div>
  );
}
