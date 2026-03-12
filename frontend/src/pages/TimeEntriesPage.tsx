import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import api from '../api/client';
import { TimeEntry, Issue } from '../types';
import Combobox from '../components/Combobox';
import NumberInput from '../components/NumberInput';
import TextInput from '../components/TextInput';
import DateInput from '../components/DateInput';
import Modal from '../components/Modal';

export default function TimeEntriesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [issueId, setIssueId] = useState('');
  const [hours, setHours] = useState('');
  const [activity, setActivity] = useState('開発');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().split('T')[0]);
  const [comments, setComments] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  const load = () => {
    api.get('/time-entries', { params: { projectId } }).then((res) => setEntries(res.data));
    api.get('/issues', { params: { projectId } }).then((res) => setIssues(res.data));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data = {
      projectId: Number(projectId),
      issueId: issueId ? Number(issueId) : null,
      hours: Number(hours),
      activity,
      spentOn,
      comments,
    };

    if (editingEntryId) {
      await api.put(`/time-entries/${editingEntryId}`, data);
    } else {
      await api.post('/time-entries', data);
    }

    handleCloseForm();
    load();
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setIssueId(entry.issueId ? String(entry.issueId) : '');
    setHours(String(entry.hours));
    setActivity(entry.activity);
    setSpentOn(entry.spentOn.split('T')[0]);
    setComments(entry.comments || '');
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
    setHours('');
    setComments('');
    setIssueId('');
    setActivity('開発');
    setSpentOn(new Date().toISOString().split('T')[0]);
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

      <Modal
        isOpen={showForm}
        onClose={handleCloseForm}
        title={editingEntryId ? "時間記録の編集" : "時間記録の追加"}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Combobox
                  label="チケット"
                  options={issues.map((i) => ({ value: String(i.id), label: `#${i.id} ${i.subject}` }))}
                  value={issueId}
                  onChange={setIssueId}
                  size="medium"
                />
              </div>
              <div>
                <NumberInput
                  label="時間 *"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  step="0.25"
                  min="0.25"
                  endAdornment="時間"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Combobox
                  label="活動"
                  options={[
                    { value: '開発', label: '開発' },
                    { value: '設計', label: '設計' },
                    { value: 'レビュー', label: 'レビュー' },
                    { value: 'テスト', label: 'テスト' },
                    { value: 'ドキュメント', label: 'ドキュメント' },
                    { value: 'その他', label: 'その他' },
                  ]}
                  value={activity}
                  onChange={setActivity}
                  size="medium"
                />
              </div>
              <div>
                <DateInput
                  label="日付"
                  value={spentOn}
                  onChange={setSpentOn}
                  required
                />
              </div>
            </div>
            <div>
              <TextInput
                label="コメント"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                size="medium"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleCloseForm}
              className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-300">キャンセル</button>
            <button type="submit" className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm hover:bg-sky-700">
              {editingEntryId ? '更新' : '追加'}
            </button>
          </div>
        </form>
      </Modal>

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
