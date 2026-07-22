import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { isLeafIssue } from '../utils/issueTree';

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [filterTrackerIds, setFilterTrackerIds] = useState<(number | string)[]>([]);
  const [filterStatusIds, setFilterStatusIds] = useState<(number | string)[]>([]);
  const [filterAssignedToIds, setFilterAssignedToIds] = useState<(number | string)[]>([]);
  const [dueDateStart, setDueDateStart] = useState('');
  const [dueDateEnd, setDueDateEnd] = useState('');
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [newIssueStatusId, setNewIssueStatusId] = useState<number | undefined>(undefined);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      // 祖先解決のためプロジェクト内の全チケットを取得（フィルタはクライアント側）
      const [issuesRes, metaRes] = await Promise.all([
        api.get('/issues', { params: { projectId } }),
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
  }, [projectId]);

  const leafIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (!isLeafIssue(issue, issues)) return false;
      if (filterTrackerIds.length > 0 && !filterTrackerIds.some((id) => String(id) === String(issue.trackerId))) {
        return false;
      }
      if (filterStatusIds.length > 0 && !filterStatusIds.some((id) => String(id) === String(issue.statusId))) {
        return false;
      }
      if (filterAssignedToIds.length > 0) {
        const matchUser = issue.assignedToId != null
          && filterAssignedToIds.some((id) => String(id) === String(issue.assignedToId));
        if (!matchUser) return false;
      }
      if (dueDateStart || dueDateEnd) {
        if (!issue.dueDate) return false;
        const due = issue.dueDate.slice(0, 10);
        if (dueDateStart && due < dueDateStart) return false;
        if (dueDateEnd && due > dueDateEnd) return false;
      }
      return true;
    });
  }, [issues, filterTrackerIds, filterStatusIds, filterAssignedToIds, dueDateStart, dueDateEnd]);

  const handleDrop = async (issueId: number, targetStatusId: number) => {
    const issueToUpdate = issues.find(i => i.id === issueId);
    if (!issueToUpdate || issueToUpdate.statusId === targetStatusId) return;

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

  const resetTicketSearchFilter = useCallback(() => {
    setFilterTrackerIds([]);
    setFilterStatusIds([]);
    setFilterAssignedToIds([]);
    setDueDateStart('');
    setDueDateEnd('');
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
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
          filterTrackerIds={filterTrackerIds}
          onFilterTrackerIdsChange={setFilterTrackerIds}
          filterStatusIds={filterStatusIds}
          onFilterStatusIdsChange={setFilterStatusIds}
          filterAssignedToIds={filterAssignedToIds}
          onFilterAssignedToIdsChange={setFilterAssignedToIds}
          dueDateStart={dueDateStart}
          onDueDateStartChange={setDueDateStart}
          dueDateEnd={dueDateEnd}
          onDueDateEndChange={setDueDateEnd}
          onResetFilter={resetTicketSearchFilter}
          issueCount={leafIssues.length}
        />
      </div>

      <KanbanBoard
        statuses={statuses}
        issues={leafIssues}
        hierarchyIssues={issues}
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
