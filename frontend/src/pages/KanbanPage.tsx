import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../api/client';
import { Issue, IssueStatus, IssueMetaWorkflow, PermissionMap } from '../types';
import Modal from '../components/Modal';
import { IssueFormModal } from '../components/IssueForm';
import KanbanBoard from '../components/KanbanBoard';
import IssueDetail from '../components/IssueDetail';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import TicketSearchSection from '../components/TicketSearchSection';
import { isLeafIssue } from '../utils/issueTree';
import { isStatusAssignable, isStatusTransitionAllowed } from '../utils/issueWorkflow';
import { matchesIssueFilter } from '../utils/issueFilter';
import { buildIssueListQueryParams } from '../utils/issueListQueryParams';
import type { ProjectOutletContext } from './ProjectDetailPage';

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const outlet = useOutletContext<ProjectOutletContext | null>();
  const projectPermissions: PermissionMap = outlet?.myPermissions ?? {};
  const { canInput } = usePermissions(projectPermissions);
  const canEditIssues = canInput('projects.issues');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [workflow, setWorkflow] = useState<IssueMetaWorkflow | undefined>();
  const [filterTrackerIds, setFilterTrackerIds] = useState<(number | string)[]>([]);
  const [filterStatusIds, setFilterStatusIds] = useState<(number | string)[]>([]);
  const [filterAssignedToIds, setFilterAssignedToIds] = useState<(number | string)[]>([]);
  const [filterAssignedToGroupIds, setFilterAssignedToGroupIds] = useState<(number | string)[]>([]);
  const [filterAssignedToGroupMemberIds, setFilterAssignedToGroupMemberIds] = useState<(number | string)[]>([]);
  const [dueDateStart, setDueDateStart] = useState('');
  const [dueDateEnd, setDueDateEnd] = useState('');
  const [scheduleDateStart, setScheduleDateStart] = useState('');
  const [scheduleDateEnd, setScheduleDateEnd] = useState('');
  const [includeUnscheduled, setIncludeUnscheduled] = useState(false);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [newIssueStatusId, setNewIssueStatusId] = useState<number | undefined>(undefined);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      const params = buildIssueListQueryParams({
        projectId,
        trackerIds: filterTrackerIds,
        statusIds: filterStatusIds,
        assignedToIds: filterAssignedToIds,
        assignedToGroupIds: filterAssignedToGroupIds,
      });
      const [issuesRes, metaRes] = await Promise.all([
        api.get('/issues', { params }),
        api.get('/issues/meta/options', { params: { projectId } }),
      ]);

      setIssues(issuesRes.data);
      setStatuses(metaRes.data.statuses);
      setWorkflow(metaRes.data.workflow);
    } catch (e) {
      console.error('Failed to fetch kanban data:', e);
    }
  }, [projectId, filterTrackerIds, filterStatusIds, filterAssignedToIds, filterAssignedToGroupIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const leafIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (!isLeafIssue(issue, issues)) return false;
      // トラッカー／ステータス／担当者は API 側で絞り込み済み。期日・開始終了はクライアント
      return matchesIssueFilter(issue, {
        trackerIds: [],
        statusIds: [],
        assignedToIds: [],
        assignedToGroupIds: [],
        assignedToGroupMemberIds: [],
        includeUnassigned: false,
        dueDateStart,
        dueDateEnd,
        dueDateMode: 'direct',
        dueDateRelative: '',
        scheduleDateStart,
        scheduleDateEnd,
        scheduleDateMode: 'direct',
        scheduleDateRelative: '',
        includeUnscheduled,
      });
    });
  }, [
    issues,
    dueDateStart,
    dueDateEnd,
    scheduleDateStart,
    scheduleDateEnd,
    includeUnscheduled,
  ]);

  const handleDrop = async (issueId: number, targetStatusId: number) => {
    if (!canEditIssues) return;
    const issueToUpdate = issues.find(i => i.id === issueId);
    if (!issueToUpdate || issueToUpdate.statusId === targetStatusId) return;
    if (!isStatusTransitionAllowed(workflow, issueToUpdate.statusId, targetStatusId)) return;

    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, statusId: targetStatusId } : i));

    try {
      await api.put(`/issues/${issueId}`, { statusId: targetStatusId });
    } catch (err: any) {
      alert(err.response?.data?.error || 'ステータスの更新に失敗しました');
      fetchData();
    }
  };

  const openNewIssueForColumn = (statusId: number) => {
    if (!canEditIssues) return;
    if (!isStatusAssignable(workflow, statusId)) return;
    setNewIssueStatusId(statusId);
    setIsNewIssueModalOpen(true);
  };

  const canDropToStatus = useCallback(
    (issueId: number, targetStatusId: number) => {
      const issue = issues.find((i) => i.id === issueId);
      if (!issue) return false;
      return isStatusTransitionAllowed(workflow, issue.statusId, targetStatusId);
    },
    [issues, workflow]
  );

  const canCreateInStatus = useCallback(
    (statusId: number) => isStatusAssignable(workflow, statusId),
    [workflow]
  );

  const handleIssueClick = (issueId: number) => {
    setSelectedIssueId(issueId);
    setIsDetailModalOpen(true);
  };

  const handleEditFromDetail = () => {
    if (!canEditIssues) return;
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
    setFilterAssignedToGroupIds([]);
    setFilterAssignedToGroupMemberIds([]);
    setDueDateStart('');
    setDueDateEnd('');
    setScheduleDateStart('');
    setScheduleDateEnd('');
    setIncludeUnscheduled(false);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <div className="px-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-700">カンバンボード</h2>
          {canEditIssues && (
          <button
            onClick={() => { setNewIssueStatusId(undefined); setIsNewIssueModalOpen(true); }}
            className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} className="w-4 h-4" />
            新規チケット
          </button>
          )}
        </div>
        <TicketSearchSection
          filterTrackerIds={filterTrackerIds}
          onFilterTrackerIdsChange={setFilterTrackerIds}
          filterStatusIds={filterStatusIds}
          onFilterStatusIdsChange={setFilterStatusIds}
          filterAssignedToIds={filterAssignedToIds}
          onFilterAssignedToIdsChange={setFilterAssignedToIds}
          filterAssignedToGroupIds={filterAssignedToGroupIds}
          onFilterAssignedToGroupIdsChange={setFilterAssignedToGroupIds}
          filterAssignedToGroupMemberIds={filterAssignedToGroupMemberIds}
          onFilterAssignedToGroupMemberIdsChange={setFilterAssignedToGroupMemberIds}
          dueDateStart={dueDateStart}
          onDueDateStartChange={setDueDateStart}
          dueDateEnd={dueDateEnd}
          onDueDateEndChange={setDueDateEnd}
          scheduleDateStart={scheduleDateStart}
          onScheduleDateStartChange={setScheduleDateStart}
          scheduleDateEnd={scheduleDateEnd}
          onScheduleDateEndChange={setScheduleDateEnd}
          includeUnscheduled={includeUnscheduled}
          onIncludeUnscheduledChange={setIncludeUnscheduled}
          onResetFilter={resetTicketSearchFilter}
          issueCount={leafIssues.length}
        />
      </div>

      <KanbanBoard
        statuses={statuses}
        issues={leafIssues}
        hierarchyIssues={issues}
        onDrop={handleDrop}
        onNewIssue={canEditIssues ? openNewIssueForColumn : undefined}
        onIssueClick={handleIssueClick}
        canDrag={canEditIssues}
        canDropToStatus={canDropToStatus}
        canCreateInStatus={canCreateInStatus}
      />

      <IssueFormModal
        isOpen={isNewIssueModalOpen}
        onClose={() => setIsNewIssueModalOpen(false)}
        title="新規チケット作成"
        projectId={String(projectId)}
        defaultStatusId={newIssueStatusId}
        permissions={projectPermissions}
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
            onEdit={canEditIssues ? handleEditFromDetail : undefined}
            permissions={projectPermissions}
          />
        )}
      </Modal>

      {selectedIssueId && (
        <IssueFormModal
          isOpen={isEditModalOpen}
          onClose={closeModal}
          title="チケット編集"
          issueId={String(selectedIssueId)}
          permissions={projectPermissions}
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
