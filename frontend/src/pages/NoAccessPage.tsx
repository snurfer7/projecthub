import { Link } from 'react-router-dom';

interface Props {
  onLogout: () => void;
}

export default function NoAccessPage({ onLogout }: Props) {
  return (
    <div className="max-w-lg mx-auto mt-16 bg-white rounded-lg shadow p-8 text-center">
      <h1 className="text-xl font-bold text-slate-800 mb-3">アクセス権限がありません</h1>
      <p className="text-sm text-gray-600 mb-6">
        利用可能な機能がありません。権限の付与後は一度ログアウトして再ログインしてください。
      </p>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 text-sm"
        >
          ログアウト
        </button>
        <Link to="/settings" className="px-4 py-2 border rounded text-sm hover:bg-gray-50">
          設定
        </Link>
      </div>
    </div>
  );
}
