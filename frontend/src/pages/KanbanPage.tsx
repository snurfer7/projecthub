import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../api/client';
import { Issue, IssueStatus } from '../types';
import Modal from '../components/Modal';
import { IssueFormModal } from '../components/IssueForm';
import KanbanBoard from '../components/KanbanBoard';
import IssueDetail from '../components/IssueDetail';
import { useAuth } from '../hooks/useAuth';
import TicketSearchSection from '../components/TicketSearchSection';

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [filterTrackerId, setFilterTrackerId] = useState<number | ''>('');
  const [filterStatusId, setFilterStatusId] = useState<number | ''>('');
  const [filterAssignedToId, setFilterAssignedToId] = useState<number | ''>('');
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [newIssueStatusId, setNewIssueStatusId] = useState<number | undefined>(undefined);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      const params: any = { projectId };
      if (filterTrackerId) params.trackerId = filterTrackerId;
      if (filterStatusId) params.statusId = filterStatusId;
      if (filterAssignedToId) params.assignedToId = filterAssignedToId;

      const [issuesRes, metaRes] = await Promise.all([
        api.get('/issues', { params }),
        api.get('/issues/meta/options', { params: { projectId } }),
      ]);

      setIssues(issuesRes.data);
      setStatuses(metaRes.data.statuses);
    } catch (e) {
      console.error('Failed to fetch kanban data:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId, filterTrackerId, filterStatusId, filterAssignedToId]);

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
      <div className="px-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-700">カンバンボード</h2>
          <button
            onClick={() => { setNewIssueStatusId(undefined); setIsNewIssueModalOpen(true); }}
            className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} className="w-4 h-4" />
            新規チケット
          </button>
        </div>
        <TicketSearchSection
          filterTrackerId={filterTrackerId}
          onFilterTrackerIdChange={setFilterTrackerId}
          filterStatusId={filterStatusId}
          onFilterStatusIdChange={setFilterStatusId}
          filterAssignedToId={filterAssignedToId}
          onFilterAssignedToIdChange={setFilterAssignedToId}
          issueCount={issues.length}
        />
      </div>

      <KanbanBoard
        statuses={statuses}
        issues={issues}
        onDrop={handleDrop}
        onNewIssue={openNewIssueForColumn}
        onIssueClick={handleIssueClick}
      />

      <IssueFormModal
        isOpen={isNewIssueModalOpen}
        onClose={() => setIsNewIssueModalOpen(false)}
        title="新規チケット作成"
        projectId={String(projectId)}
        defaultStatusId={newIssueStatusId}
        onSuccess={() => {
          setIsNewIssueModalOpen(false);
          fetchData();
        }}
        onCancel={() => setIsNewIssueModalOpen(false)}
      />

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

      {selectedIssueId && (
        <IssueFormModal
          isOpen={isEditModalOpen}
          onClose={closeModal}
          title="チケット編集"
          issueId={String(selectedIssueId)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchData();
            setIsDetailModalOpen(true);
          }}
          onCancel={() => {
            setIsEditModalOpen(false);
            setIsDetailModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
