import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { TimeEntry, Issue } from '../types';
import Combobox from '../components/Combobox';
import NumberInput from '../components/NumberInput';
import TextInput from '../components/TextInput';

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

  const load = () => {
    api.get('/time-entries', { params: { projectId } }).then((res) => setEntries(res.data));
    api.get('/issues', { params: { projectId } }).then((res) => setIssues(res.data));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/time-entries', {
      projectId: Number(projectId),
      issueId: issueId ? Number(issueId) : null,
      hours: Number(hours),
      activity,
      spentOn,
      comments,
    });
    setShowForm(false);
    setHours('');
    setComments('');
    setIssueId('');
    load();
  };

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">時間記録</h1>
          <p className="text-sm text-gray-500 mt-1">合計: {totalHours.toFixed(1)} 時間</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700">記録を追加</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
              <label className="block text-xs text-gray-500 mb-1">日付 *</label>
              <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <TextInput
              label="コメント"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              size="medium"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm hover:bg-sky-700">追加</button>
            <button type="button" onClick={() => setShowForm(false)}
              className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-300">キャンセル</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">日付</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">チケット</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ユーザー</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">活動</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">時間</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">コメント</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{entry.spentOn.split('T')[0]}</td>
                <td className="px-4 py-3">
                  {entry.issue ? (
                    <Link to={`/issues/${entry.issue.id}`} className="text-sky-600 hover:underline">
                      #{entry.issue.id} {entry.issue.subject}
                    </Link>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">{entry.user.lastName} {entry.user.firstName}</td>
                <td className="px-4 py-3">{entry.activity}</td>
                <td className="px-4 py-3 font-medium">{entry.hours}h</td>
                <td className="px-4 py-3 text-gray-500">{entry.comments || '-'}</td>
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
