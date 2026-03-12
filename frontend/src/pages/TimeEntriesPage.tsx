import api from '../api/client';
import { TimeEntry } from '../types';
import TimeEntryModal from '../components/TimeEntryModal';

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
export default function TimeEntriesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  const load = () => {
    api.get('/time-entries', { params: { projectId } }).then((res) => setEntries(res.data));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この時間記録を削除しますか？')) return;
    try {
      await api.delete(`/time-entries/${id}`);
      load();
    } catch (e) {
      alert('削除に失敗しました');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEntryId(null);
  };

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-700">時間記録</h2>
          <p className="text-sm text-gray-500 mt-2">合計: {totalHours.toFixed(1)} 時間</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700">記録を追加</button>
      </div>

      <TimeEntryModal
        isOpen={showForm}
        onClose={handleCloseForm}
        onSuccess={load}
        projectId={Number(projectId)}
        entry={entries.find(e => e.id === editingEntryId)}
      />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">日付</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">チケット</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ユーザー</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">活動</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">時間</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">コメント</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{entry.spentOn.split('T')[0]}</td>
                <td className="px-4 py-3">
                  {entry.issue ? (
                    <Link to={`/issues/${entry.issue.id}`} className="text-sky-600 hover:underline line-clamp-1">
                      #{entry.issue.id} {entry.issue.subject}
                    </Link>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.user.lastName} {entry.user.firstName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{entry.activity}</td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">{entry.hours}h</td>
                <td className="px-4 py-3 text-gray-500 line-clamp-1">{entry.comments || '-'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="text-sky-600 hover:text-sky-800 mr-4 cursor-pointer"
                    title="編集"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                    title="削除"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && (
          <div className="text-center py-8 text-gray-500">時間記録がありません</div>
        )}
      </div>
    </div>
  );
}
