import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { List, BarChart2, Kanban, Users } from 'lucide-react';
import api from '../api/client';
import { Project, Company, Issue, IssueStatus, Tracker } from '../types';
import Modal from '../components/Modal';
import GanttChart from '../components/GanttChart';
import ChartTicketSearchSection from '../components/ChartTicketSearchSection';
import KanbanBoard from '../components/KanbanBoard';
import IssueDetail from '../components/IssueDetail';
import IssueForm from '../components/IssueForm';
import Combobox from '../components/Combobox';
import TextInput from '../components/TextInput';
import DateInput from '../components/DateInput';
import { useAuth } from '../hooks/useAuth';

const PRIORITY_COLORS: Record<string, string> = {
  '今すぐ': 'bg-red-100 text-red-700 border-red-200',
  '急いで': 'bg-red-100 text-red-700 border-red-200',
  '高め': 'bg-orange-100 text-orange-700 border-orange-200',
  '通常': 'bg-gray-100 text-gray-600 border-gray-200',
  '低め': 'bg-blue-50 text-blue-500 border-blue-100',
};

const TRACKER_COLORS: Record<string, string> = {
  'バグ': 'bg-red-500',
  'Bug': 'bg-red-500',
  '機能': 'bg-sky-500',
  'Feature': 'bg-sky-500',
  'サポート': 'bg-purple-500',
  'Support': 'bg-purple-500',
};

function getTrackerColor(name: string) {
  return TRACKER_COLORS[name] || 'bg-slate-400';
}

function getPriorityClass(name: string) {
  return PRIORITY_COLORS[name] || 'bg-gray-100 text-gray-600 border-gray-200';
}



export default function ProjectListPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'gantt' | 'kanban'>('list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilterStartMonth, setListFilterStartMonth] = useState('');
  const [listFilterEndMonth, setListFilterEndMonth] = useState('');
  const [listFilterCompanyIds, setListFilterCompanyIds] = useState<(number | string)[]>([]);

  // Gantt-related state
  const [ganttIssues, setGanttIssues] = useState<Issue[]>([]);
  const [ganttProjects, setGanttProjects] = useState<Project[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [ganttZoom, setGanttZoom] = useState<'day' | 'month' | 'year'>('day');
  const [ganttStartValue, setGanttStartValue] = useState('');
  const [ganttEndValue, setGanttEndValue] = useState('');
  const [ganttFilterTrackerId, setGanttFilterTrackerId] = useState<number | ''>('');
  const [ganttFilterStatusId, setGanttFilterStatusId] = useState<number | ''>('');
  const [ganttFilterAssignedToId, setGanttFilterAssignedToId] = useState<number | ''>('');
  const [ganttCollapsedProjects, setGanttCollapsedProjects] = useState<Set<number>>(new Set());

  // Kanban-related state
  const [kanbanIssues, setKanbanIssues] = useState<Issue[]>([]);
  const [kanbanStatuses, setKanbanStatuses] = useState<IssueStatus[]>([]);
  const [kanbanTrackers, setKanbanTrackers] = useState<Tracker[]>([]);
  const [kanbanAssignees, setKanbanAssignees] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const [kanbanFilterTrackerId, setKanbanFilterTrackerId] = useState<number | ''>('');
  const [kanbanFilterStatusId, setKanbanFilterStatusId] = useState<number | ''>('');
  const [kanbanFilterAssignedToId, setKanbanFilterAssignedToId] = useState<number | ''>('');
  const [kanbanFilterStartMonth, setKanbanFilterStartMonth] = useState('');
  const [kanbanFilterEndMonth, setKanbanFilterEndMonth] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { user } = useAuth();


  // Project modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectIdentifier, setProjectIdentifier] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCompanyId, setProjectCompanyId] = useState('');
  const [projectParentId, setProjectParentId] = useState('');
  const [projectDueDate, setProjectDueDate] = useState('');
  const [projectError, setProjectError] = useState('');

  const loadProjects = () => {
    api.get('/projects').then((res) => setProjects(res.data));
  };

  const loadCompanies = () => {
    api.get('/companies').then((res) => setCompanies(res.data));
  };

  const loadGanttData = useCallback(() => {
    api.get('/gantt/all').then((res) => {
      setGanttProjects(res.data.projects);
      setGanttIssues(res.data.issues);
    });
    api.get('/admin/settings/time').then((res) => {
      setSystemSettings(res.data);
    });
  }, []);

  const loadKanbanData = useCallback(() => {
    Promise.all([
      api.get('/issues'),
      api.get('/issues/meta/options'),
    ]).then(([issuesRes, metaRes]) => {
      setKanbanIssues(issuesRes.data);
      setKanbanStatuses(metaRes.data.statuses);
      setKanbanTrackers(metaRes.data.trackers);
      setKanbanAssignees(metaRes.data.users);
    });
  }, []);

  useEffect(() => {
    loadProjects();
    loadCompanies();
  }, []);

  useEffect(() => {
    if (viewMode === 'gantt') loadGanttData();
    if (viewMode === 'kanban') loadKanbanData();
  }, [viewMode, loadGanttData, loadKanbanData]);

  const openCreateProjectModal = () => {
    setEditingProjectId(null);
    setProjectName('');
    setProjectIdentifier('');
    setProjectDescription('');
    setProjectCompanyId('');
    setProjectParentId('');
    setProjectDueDate('');
    setProjectError('');
    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setEditingProjectId(null);
    setProjectError('');
  };

  const handleSubmitProject = async (e: FormEvent) => {
    e.preventDefault();
    setProjectError('');
    try {
      const data = {
        name: projectName,
        identifier: projectIdentifier,
        description: projectDescription || null,
        companyId: projectCompanyId ? Number(projectCompanyId) : null,
        parentId: projectParentId ? Number(projectParentId) : null,
        dueDate: projectDueDate || null,
      };
      if (editingProjectId) {
        await api.put(`/projects/${editingProjectId}`, data);
      } else {
        await api.post('/projects', data);
      }
      closeProjectModal();
      loadProjects();
    } catch (err: any) {
      setProjectError(err.response?.data?.error || (editingProjectId ? '更新に失敗しました' : '作成に失敗しました'));
    }
  };

  const handleUpdateIssue = useCallback(async (id: number, data: { startDate?: string; dueDate?: string }) => {
    await api.put(`/issues/${id}`, data);
    loadGanttData();
  }, [loadGanttData]);

  const handleCreateRelation = useCallback(async (fromId: number, toId: number) => {
    try {
      await api.post(`/issues/${fromId}/relations`, { issueToId: toId, relationType: 'precedes' });
      loadGanttData();
    } catch (e) {
      console.error('Failed to create relation:', e);
      alert('関連の作成に失敗しました');
    }
  }, [loadGanttData]);

  // Kanban drag handlers

  const handleKanbanDrop = async (droppedIssueId: number, targetStatusId: number) => {
    const issueToDrop = kanbanIssues.find(i => i.id === droppedIssueId);
    if (!issueToDrop || issueToDrop.statusId === targetStatusId) return;

    setKanbanIssues((prev) =>
      prev.map((issue) =>
        issue.id === issueToDrop.id
          ? { ...issue, statusId: targetStatusId, status: kanbanStatuses.find((s) => s.id === targetStatusId) }
          : issue
      )
    );
    try {
      await api.put(`/issues/${issueToDrop.id}`, { statusId: targetStatusId });
    } catch {
      loadKanbanData();
    }
  };

  const handleIssueClick = (issueId: number) => {
    setSelectedIssueId(issueId);
    setIsDetailModalOpen(true);
  };

  const handleEditFromDetail = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  const closeIssueModal = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedIssueId(null);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchText = p.name.toLowerCase().includes(q)
          || p.identifier.toLowerCase().includes(q)
          || (p.company && p.company.name.toLowerCase().includes(q));
        if (!matchText) return false;
      }
      if (listFilterCompanyIds.length > 0 && (!p.companyId || !listFilterCompanyIds.some(id => String(id) === String(p.companyId)))) return false;
      if (p.dueDate) {
        const due = p.dueDate.slice(0, 10);
        if (listFilterStartMonth && due < listFilterStartMonth) return false;
        if (listFilterEndMonth && due > listFilterEndMonth) return false;
      }
      return true;
    });
  }, [projects, searchQuery, listFilterStartMonth, listFilterEndMonth, listFilterCompanyIds]);

  const kanbanFilteredIssues = useMemo(() => {
    return kanbanIssues.filter((issue) => {
      if (kanbanFilterTrackerId && issue.trackerId !== kanbanFilterTrackerId) return false;
      if (kanbanFilterStatusId && issue.statusId !== kanbanFilterStatusId) return false;
      if (kanbanFilterAssignedToId && issue.assignedToId !== kanbanFilterAssignedToId) return false;
      if (issue.dueDate) {
        const due = issue.dueDate.slice(0, 10);
        if (kanbanFilterStartMonth && due < kanbanFilterStartMonth) return false;
        if (kanbanFilterEndMonth && due > kanbanFilterEndMonth) return false;
      }
      return true;
    });
  }, [kanbanIssues, kanbanFilterTrackerId, kanbanFilterStatusId, kanbanFilterAssignedToId, kanbanFilterStartMonth, kanbanFilterEndMonth]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">プロジェクト</h1>

        {/* View toggle button group (Aligned with title on the right) */}
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'list'
              ? 'bg-sky-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            <List size={15} />
            一覧
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${viewMode === 'gantt'
              ? 'bg-sky-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            <BarChart2 size={15} />
            ガントチャート
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${viewMode === 'kanban'
              ? 'bg-sky-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Kanban size={15} />
            カンバン
          </button>
        </div>
      </div>

      {/* List toolbar (matches gantt toolbar style) */}
      {
        viewMode === 'list' && (
          <div className="flex gap-3 mb-4 items-center">
            <div className="bg-white rounded-lg shadow p-3 flex-1 flex flex-wrap items-center gap-3">
              <span className="text-xs text-gray-500">検索:</span>
              <TextInput
                placeholder="プロジェクト名、識別子、企業名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                showFloatingLabel={false}
                className="w-64"
              />
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">期間:</span>
                <div className="flex items-center gap-1">
                  <DateInput
                    value={listFilterStartMonth}
                    onChange={setListFilterStartMonth}
                    size="small"
                    showFloatingLabel={false}
                    placeholder="開始"
                    className="w-32"
                  />
                  <span className="text-gray-400 text-xs">〜</span>
                  <DateInput
                    value={listFilterEndMonth}
                    onChange={setListFilterEndMonth}
                    size="small"
                    showFloatingLabel={false}
                    placeholder="終了"
                    className="w-32"
                  />
                </div>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex items-center gap-2">
                <Combobox
                  label="企業"
                  options={companies.map(c => ({ value: c.id, label: c.name }))}
                  value={listFilterCompanyIds}
                  onChange={(values) => setListFilterCompanyIds(values)}
                  placeholder="全企業"
                  className="w-64"
                  isMulti={true}
                  size="small"
                />
              </div>
              <div className="ml-auto text-xs text-gray-400">{filteredProjects.length} 件</div>
            </div>
            <button onClick={openCreateProjectModal}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm shadow-sm transition-all whitespace-nowrap">
              新規プロジェクト
            </button>
          </div>
        )
      }

      {/* Kanban toolbar */}
      {
        viewMode === 'kanban' && (
          <div className="flex gap-3 mb-4 items-center">
            <div className="bg-white rounded-lg shadow p-3 flex-1 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">期間:</span>
                <div className="flex items-center gap-1">
                  <DateInput
                    value={kanbanFilterStartMonth}
                    onChange={setListFilterStartMonth}
                    size="small"
                    showFloatingLabel={false}
                    placeholder="開始"
                    className="w-32"
                  />
                  <span className="text-gray-400 text-xs">〜</span>
                  <DateInput
                    value={kanbanFilterEndMonth}
                    onChange={setListFilterEndMonth}
                    size="small"
                    showFloatingLabel={false}
                    placeholder="終了"
                    className="w-32"
                  />
                </div>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <Combobox
                label="トラッカー"
                options={[
                  { value: '', label: '全トラッカー' },
                  ...kanbanTrackers.map((t) => ({ value: String(t.id), label: t.name }))
                ]}
                value={String(kanbanFilterTrackerId)}
                onChange={(val) => setKanbanFilterTrackerId(val ? Number(val) : '')}
                size="small"
              />
              <Combobox
                label="ステータス"
                options={[
                  { value: '', label: '全ステータス' },
                  ...kanbanStatuses.map((s) => ({ value: String(s.id), label: s.name }))
                ]}
                value={String(kanbanFilterStatusId)}
                onChange={(val) => setKanbanFilterStatusId(val ? Number(val) : '')}
                size="small"
              />
              <Combobox
                label="担当者"
                options={[
                  { value: '', label: '全担当者' },
                  ...kanbanAssignees.map((a) => ({ value: String(a.id), label: `${a.lastName} ${a.firstName}` }))
                ]}
                value={String(kanbanFilterAssignedToId)}
                onChange={(val) => setKanbanFilterAssignedToId(val ? Number(val) : '')}
                size="small"
              />
              <div className="ml-auto text-xs text-gray-400">{kanbanFilteredIssues.length} 件</div>
            </div>
            <button onClick={openCreateProjectModal}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm shadow-sm transition-all whitespace-nowrap">
              新規プロジェクト
            </button>
          </div>
        )
      }

      {/* List view */}
      {
        viewMode === 'list' && (
          <div className="bg-white rounded-lg shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">プロジェクト名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">識別子</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">企業</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">期限</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">チケット数</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}>
                    <td className="px-4 py-3 text-sky-600 font-medium">{project.name}</td>
                    <td className="px-4 py-3 text-gray-600">{project.identifier}</td>
                    <td className="px-4 py-3 text-gray-600">{project.company?.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {project.dueDate ? new Date(project.dueDate).toLocaleDateString('ja-JP') : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{project._count?.issues || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${project.status === 'active' ? 'bg-green-100 text-green-700' :
                        project.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                        {project.status === 'active' ? '有効' : project.status === 'closed' ? '終了' : 'アーカイブ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {projects.length === 0 && (
              <div className="text-center py-8 text-gray-500">プロジェクトが登録されていません</div>
            )}
          </div>
        )
      }

      {/* Gantt chart view */}
      {
        viewMode === 'gantt' && (
          <>
            <div className="flex gap-3 mb-4 items-center">
              <div className="flex-1">
                <ChartTicketSearchSection
                  zoom={ganttZoom}
                  onZoomChange={setGanttZoom}
                  startValue={ganttStartValue}
                  onStartValueChange={setGanttStartValue}
                  endValue={ganttEndValue}
                  onEndValueChange={setGanttEndValue}
                  filterTrackerId={ganttFilterTrackerId}
                  onFilterTrackerIdChange={setGanttFilterTrackerId}
                  filterStatusId={ganttFilterStatusId}
                  onFilterStatusIdChange={setGanttFilterStatusId}
                  filterAssignedToId={ganttFilterAssignedToId}
                  onFilterAssignedToIdChange={setGanttFilterAssignedToId}
                  issueCount={ganttIssues.length}
                  showProject={true}
                  onCollapseAll={() => setGanttCollapsedProjects(new Set(ganttProjects.map(p => p.id)))}
                  onExpandAll={() => setGanttCollapsedProjects(new Set())}
                />
              </div>
              <button onClick={openCreateProjectModal}
                className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm shadow-sm transition-all whitespace-nowrap flex-shrink-0">
                新規プロジェクト
              </button>
            </div>
            <GanttChart
              issues={ganttIssues}
              projects={ganttProjects}
              showProject
              systemSettings={systemSettings}
              onUpdateIssue={handleUpdateIssue}
              onIssueCreated={loadGanttData}
              onRelationCreated={handleCreateRelation}
              zoom={ganttZoom}
              onZoomChange={setGanttZoom}
              startValue={ganttStartValue}
              onStartValueChange={setGanttStartValue}
              endValue={ganttEndValue}
              onEndValueChange={setGanttEndValue}
              filterTrackerId={ganttFilterTrackerId}
              onFilterTrackerIdChange={setGanttFilterTrackerId}
              filterStatusId={ganttFilterStatusId}
              onFilterStatusIdChange={setGanttFilterStatusId}
              filterAssignedToId={ganttFilterAssignedToId}
              onFilterAssignedToIdChange={setGanttFilterAssignedToId}
              collapsedProjects={ganttCollapsedProjects}
              onCollapsedProjectsChange={setGanttCollapsedProjects}
            />
          </>
        )
      }

      {/* Kanban board view */}
      {
        viewMode === 'kanban' && (
          <KanbanBoard
            statuses={kanbanStatuses}
            issues={kanbanFilteredIssues}
            onDrop={handleKanbanDrop}
            onIssueClick={handleIssueClick}
            showProjectName={true}
          />
        )
      }

      {/* Project create/edit modal */}
      <Modal
        isOpen={showProjectModal}
        onClose={closeProjectModal}
        title={editingProjectId ? 'プロジェクト情報編集' : 'プロジェクト登録'}
      >
        {projectError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{projectError}</div>}
        <form onSubmit={handleSubmitProject}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <TextInput
              label="プロジェクト名 *"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
            <TextInput
              label="識別子 *"
              value={projectIdentifier}
              onChange={(e) => setProjectIdentifier(e.target.value)}
              required
              pattern="[a-z0-9-]+"
              title="小文字英数字とハイフンのみ"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Combobox
                label="企業"
                options={[
                  { value: '', label: 'なし' },
                  ...companies.map((c) => ({ value: String(c.id), label: c.name }))
                ]}
                value={projectCompanyId}
                onChange={setProjectCompanyId}
                size="medium"
              />
            </div>
            <div>
              <Combobox
                label="親プロジェクト"
                options={[
                  { value: '', label: 'なし' },
                  ...projects.map((p) => ({ value: String(p.id), label: p.name }))
                ]}
                value={projectParentId}
                onChange={(val) => {
                  setProjectParentId(val);
                  if (val) {
                    const parent = projects.find((p) => String(p.id) === val);
                    if (parent?.dueDate) {
                      setProjectDueDate(parent.dueDate.slice(0, 10));
                    }
                  }
                }}
                size="medium"
              />
            </div>
          </div>
          <div className="mb-4">
            <DateInput
              label="期限日"
              id="project-due-date"
              value={projectDueDate}
              onChange={setProjectDueDate}
            />
          </div>
          <div className="mb-4">
            <TextInput
              label="説明"
              isMultiline
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeProjectModal}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
              {editingProjectId ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={closeIssueModal}
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
        onClose={closeIssueModal}
        title="チケット編集"
      >
        {isEditModalOpen && selectedIssueId && (
          <IssueForm
            issueId={String(selectedIssueId)}
            onSuccess={() => {
              setIsEditModalOpen(false);
              loadKanbanData();
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
