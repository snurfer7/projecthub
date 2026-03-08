import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { TimeEntry, Issue } from '../types';

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
              <label className="block text-xs text-gray-500 mb-1">チケット</label>
              <select value={issueId} onChange={(e) => setIssueId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">なし</option>
                {issues.map((i) => <option key={i.id} value={i.id}>#{i.id} {i.subject}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">時間 *</label>
              <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} required step="0.25" min="0.25"
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">活動</label>
              <select value={activity} onChange={(e) => setActivity(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                <option>開発</option><option>設計</option><option>レビュー</option><option>テスト</option><option>ドキュメント</option><option>その他</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">日付 *</label>
              <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">コメント</label>
            <input type="text" value={comments} onChange={(e) => setComments(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm" />
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
