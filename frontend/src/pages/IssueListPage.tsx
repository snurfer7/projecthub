import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pencil, Trash2, Users } from 'lucide-react';
import api from '../api/client';
import { Issue, IssueMetaOptions } from '../types';
import Modal from '../components/Modal';
import IssueForm from '../components/IssueForm';
import ConfirmationModal from '../components/ConfirmationModal';
import IssueDetail from '../components/IssueDetail';
import { useAuth } from '../hooks/useAuth';
import Combobox from '../components/Combobox';

export default function IssueListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meta, setMeta] = useState<IssueMetaOptions | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTracker, setFilterTracker] = useState('');
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [deletingIssueId, setDeletingIssueId] = useState<number | null>(null);

  const fetchIssues = () => {
    const params: any = { projectId };
    if (filterStatus) params.statusId = filterStatus;
    if (filterTracker) params.trackerId = filterTracker;
    api.get('/issues', { params }).then((res) => setIssues(res.data));
  };

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => setMeta(res.data));
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [projectId, filterStatus, filterTracker]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/issues/${id}`);
      setDeletingIssueId(null);
      fetchIssues();
    } catch (err) {
      alert('削除に失敗しました');
    }
  };

  const priorityColor = (name: string) => {
    if (name === '今すぐ' || name === '急いで') return 'text-red-600';
    if (name === '高め') return 'text-orange-500';
    return 'text-gray-600';
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-700">チケット一覧</h2>
          <button
            onClick={() => setIsNewIssueModalOpen(true)}
            className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700 cursor-pointer"
          >
            新規チケット
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
          <div>
            <Combobox
              label="ステータス"
              options={[
                { value: '', label: '全て' },
                ...(meta?.statuses || []).map(s => ({ value: String(s.id), label: s.name }))
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              size="small"
            />
          </div>
          <div>
            <Combobox
              label="トラッカー"
              options={[
                { value: '', label: '全て' },
                ...(meta?.trackers || []).map(t => ({ value: String(t.id), label: t.name }))
              ]}
              value={filterTracker}
              onChange={setFilterTracker}
              size="small"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">トラッカー</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">題名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">優先度</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">担当者</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">進捗</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{issue.id}</td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{issue.tracker?.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedIssueId(String(issue.id))}
                      className="text-sky-600 hover:underline font-medium cursor-pointer text-left w-full"
                    >
                      {issue.subject}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${issue.status?.isClosed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}>
                      {issue.status?.name}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-medium ${priorityColor(issue.priority?.name || '')}`}>
                    {issue.priority?.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {issue.assignedToGroup ? (
                      <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-indigo-400" /> {issue.assignedToGroup.name}</span>
                    ) : issue.assignedTo ? (
                      `${issue.assignedTo.lastName} ${issue.assignedTo.firstName}`
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${issue.doneRatio}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{issue.doneRatio}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingIssueId(String(issue.id))}
                      className="text-sky-600 hover:text-sky-800 mr-4 cursor-pointer"
                      title="編集"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => setDeletingIssueId(issue.id)}
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
          {issues.length === 0 && (
            <div className="text-center py-8 text-gray-500">チケットがありません</div>
          )}
        </div>

        <Modal
          isOpen={!!editingIssueId}
          onClose={() => setEditingIssueId(null)}
          title="チケット編集"
        >
          {editingIssueId && (
            <IssueForm
              issueId={editingIssueId}
              onSuccess={() => {
                setEditingIssueId(null);
                fetchIssues();
              }}
              onCancel={() => setEditingIssueId(null)}
            />
          )}
        </Modal>

        <Modal
          isOpen={!!selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
          title="チケット詳細"
          size="lg"
        >
          {selectedIssueId && user && (
            <IssueDetail
              issueId={selectedIssueId}
              user={user}
              onEdit={() => {
                setEditingIssueId(selectedIssueId);
                setSelectedIssueId(null);
              }}
              onRefresh={fetchIssues}
            />
          )}
        </Modal>

        <Modal
          isOpen={isNewIssueModalOpen}
          onClose={() => setIsNewIssueModalOpen(false)}
          title="新規チケット"
        >
          {isNewIssueModalOpen && (
            <IssueForm
              projectId={projectId}
              onSuccess={() => {
                setIsNewIssueModalOpen(false);
                fetchIssues();
              }}
              onCancel={() => setIsNewIssueModalOpen(false)}
            />
          )}
        </Modal>
        <ConfirmationModal
          isOpen={!!deletingIssueId}
          title="チケットの削除"
          message="本当にこのチケットを削除しますか？この操作は取り消せません。"
          onConfirm={() => deletingIssueId && handleDelete(deletingIssueId)}
          onCancel={() => setDeletingIssueId(null)}
          variant="danger"
        />
      </div>
    </>
  );
}
