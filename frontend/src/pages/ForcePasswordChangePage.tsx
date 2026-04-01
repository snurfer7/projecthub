import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { User } from '../types';
import TextInput from '../components/TextInput';

interface Props {
  refreshUser: () => Promise<User>;
}

export default function ForcePasswordChangePage({ refreshUser }: Props) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }
    if (newPassword.length < 6) {
      setError('新しいパスワードは6文字以上で入力してください');
      return;
    }

    try {
      setLoading(true);
      await api.put('/auth/password', { currentPassword, newPassword });
      await refreshUser();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'パスワードの変更に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-2">初回パスワード変更</h1>
        <p className="text-sm text-gray-600 mb-6">
          仮登録ユーザーは、ログイン後にパスワード変更が必要です。
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            label="現在のパスワード"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <TextInput
            label="新しいパスワード"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <TextInput
            label="新しいパスワード（確認）"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white px-4 py-2 rounded text-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? '変更中...' : 'パスワードを変更'}
          </button>
        </form>
      </div>
    </div>
  );
}
