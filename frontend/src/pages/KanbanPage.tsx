import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../api/client';
import { Issue, IssueMetaOptions, IssueStatus } from '../types';
import Modal from '../components/Modal';
import IssueForm from '../components/IssueForm';
import KanbanBoard from '../components/KanbanBoard';
import IssueDetail from '../components/IssueDetail';
import { useAuth } from '../hooks/useAuth';

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [meta, setMeta] = useState<IssueMetaOptions | null>(null);
  const [filterTracker, setFilterTracker] = useState('');
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [newIssueStatusId, setNewIssueStatusId] = useState<number | undefined>(undefined);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      const params: any = { projectId };
      if (filterTracker) params.trackerId = filterTracker;

      const [issuesRes, metaRes] = await Promise.all([
        api.get('/issues', { params }),
        api.get('/issues/meta/options', { params: { projectId } }),
      ]);

      setIssues(issuesRes.data);
      setMeta(metaRes.data);
      setStatuses(metaRes.data.statuses);
    } catch (e) {
      console.error('Failed to fetch kanban data:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId, filterTracker]);

  const handleDrop = async (issueId: number, targetStatusId: number) => {
    const issueToUpdate = issues.find(i => i.id === issueId);
    if (!issueToUpdate || issueToUpdate.statusId === targetStatusId) return;

    // Optimistic update
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, statusId: targetStatusId } : i));

    try {
      await api.put(`/issues/${issueId}`, { statusId: targetStatusId });
    } catch {
      fetchData();
    }
  };

  const openNewIssueForColumn = (statusId: number) => {
    setNewIssueStatusId(statusId);
    setIsNewIssueModalOpen(true);
  };

  const handleIssueClick = (issueId: number) => {
    setSelectedIssueId(issueId);
    setIsDetailModalOpen(true);
  };

  const handleEditFromDetail = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  const closeModal = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedIssueId(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-semibold text-slate-800">カンバンボード</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">トラッカー</label>
            <select
              value={filterTracker}
              onChange={(e) => setFilterTracker(e.target.value)}
              className="border-gray-300 rounded-md text-sm focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">すべて</option>
              {meta?.trackers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setNewIssueStatusId(undefined); setIsNewIssueModalOpen(true); }}
            className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} className="w-4 h-4" />
            新規チケット
          </button>
        </div>
      </div>

      <KanbanBoard
        statuses={statuses}
        issues={issues}
        onDrop={handleDrop}
        onNewIssue={openNewIssueForColumn}
        onIssueClick={handleIssueClick}
      />

      <Modal
        isOpen={isNewIssueModalOpen}
        onClose={() => setIsNewIssueModalOpen(false)}
        title="新規チケット作成"
      >
        {isNewIssueModalOpen && (
          <IssueForm
            projectId={String(projectId)}
            defaultStatusId={newIssueStatusId}
            onSuccess={() => {
              setIsNewIssueModalOpen(false);
              fetchData();
            }}
            onCancel={() => setIsNewIssueModalOpen(false)}
          />
        )}
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={closeModal}
        title="チケット詳細"
      >
        {isDetailModalOpen && selectedIssueId && user && (
          <IssueDetail
            issueId={String(selectedIssueId)}
            user={user}
            onEdit={handleEditFromDetail}
          />
        )}
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeModal}
        title="チケット編集"
      >
        {isEditModalOpen && selectedIssueId && (
          <IssueForm
            issueId={String(selectedIssueId)}
            onSuccess={() => {
              setIsEditModalOpen(false);
              fetchData();
              // Back to detail
              setIsDetailModalOpen(true);
            }}
            onCancel={() => {
              setIsEditModalOpen(false);
              setIsDetailModalOpen(true);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
