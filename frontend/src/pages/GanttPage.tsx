import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { Issue, Project } from '../types';
import GanttChart from '../components/GanttChart';
import TicketSearchSection from '../components/TicketSearchSection';
import { filterIssues } from '../utils/issueFilter';
import { buildIssueListQueryParams } from '../utils/issueListQueryParams';

type ZoomLevel = 'day' | 'month' | 'year';

export default function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const [filterTrackerIds, setFilterTrackerIds] = useState<(number | string)[]>([]);
  const [filterStatusIds, setFilterStatusIds] = useState<(number | string)[]>([]);
  const [filterAssignedToIds, setFilterAssignedToIds] = useState<(number | string)[]>([]);
  const [filterAssignedToGroupIds, setFilterAssignedToGroupIds] = useState<(number | string)[]>([]);
  const [filterAssignedToGroupMemberIds, setFilterAssignedToGroupMemberIds] = useState<(number | string)[]>([]);
  const [scheduleDateStart, setScheduleDateStart] = useState('');
  const [scheduleDateEnd, setScheduleDateEnd] = useState('');
  const [includeUnscheduled, setIncludeUnscheduled] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());

  const loadIssues = useCallback(() => {
    const params = buildIssueListQueryParams({
      trackerIds: filterTrackerIds,
      statusIds: filterStatusIds,
      assignedToIds: filterAssignedToIds,
      assignedToGroupIds: filterAssignedToGroupIds,
    });
    api.get(`/gantt/project/${projectId}`, { params }).then((res) => {
      setProject(res.data.project);
      setIssues(res.data.issues);
    });
    api.get(`/projects/${projectId}`).then((res) => {
      setProject((prev) => ({ ...(prev ?? res.data), ...res.data, myPermissions: res.data.myPermissions }));
    }).catch(() => {});
    api.get('/settings/calendar').then((res) => {
      setSystemSettings(res.data);
    }).catch(() => {});
  }, [projectId, filterTrackerIds, filterStatusIds, filterAssignedToIds, filterAssignedToGroupIds]);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  const handleUpdateIssue = useCallback(async (id: number, data: { startDate?: string; endDate?: string; dueDate?: string }) => {
    await api.put(`/issues/${id}`, data);
    loadIssues();
  }, [loadIssues]);

  const handleCreateRelation = useCallback(async (fromId: number, toId: number) => {
    try {
      await api.post(`/issues/${fromId}/relations`, { issueToId: toId, relationType: 'precedes' });
      loadIssues();
    } catch (e) {
      console.error('Failed to create relation:', e);
      alert('関連の作成に失敗しました');
    }
  }, [loadIssues]);

  const scheduleFilteredIssues = useMemo(
    () =>
      filterIssues(issues, {
        trackerIds: [],
        statusIds: [],
        assignedToIds: [],
        assignedToGroupIds: [],
        assignedToGroupMemberIds: [],
        includeUnassigned: false,
        dueDateStart: '',
        dueDateEnd: '',
        dueDateMode: 'direct',
        dueDateRelative: '',
        scheduleDateStart,
        scheduleDateEnd,
        scheduleDateMode: 'direct',
        scheduleDateRelative: '',
        includeUnscheduled,
      }),
    [issues, scheduleDateStart, scheduleDateEnd, includeUnscheduled],
  );

  const resetTicketSearchFilter = useCallback(() => {
    setFilterTrackerIds([]);
    setFilterStatusIds([]);
    setFilterAssignedToIds([]);
    setFilterAssignedToGroupIds([]);
    setFilterAssignedToGroupMemberIds([]);
    setScheduleDateStart('');
    setScheduleDateEnd('');
    setIncludeUnscheduled(false);
    setStartValue('');
    setEndValue('');
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-700">ガントチャート</h2>
      </div>
      <div className="flex gap-3 mb-4 items-center">
        <div className="flex-1">
          <TicketSearchSection
            zoom={zoom}
            startValue={startValue}
            onStartValueChange={setStartValue}
            endValue={endValue}
            onEndValueChange={setEndValue}
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
            scheduleDateStart={scheduleDateStart}
            onScheduleDateStartChange={setScheduleDateStart}
            scheduleDateEnd={scheduleDateEnd}
            onScheduleDateEndChange={setScheduleDateEnd}
            includeUnscheduled={includeUnscheduled}
            onIncludeUnscheduledChange={setIncludeUnscheduled}
            onResetFilter={resetTicketSearchFilter}
            issueCount={scheduleFilteredIssues.length}
          />
        </div>
      </div>
      <GanttChart
        issues={scheduleFilteredIssues}
        projects={project ? [project] : []}
        systemSettings={systemSettings}
        issueFormPermissions={project?.myPermissions}
        onUpdateIssue={handleUpdateIssue}
        onIssueCreated={loadIssues}
        onRelationCreated={handleCreateRelation}
        zoom={zoom}
        onZoomChange={setZoom}
        startValue={startValue}
        onStartValueChange={setStartValue}
        endValue={endValue}
        onEndValueChange={setEndValue}
        filterTrackerIds={[]}
        filterStatusIds={[]}
        filterAssignedToIds={[]}
        filterAssignedToGroupIds={[]}
        filterAssignedToGroupMemberIds={[]}
        collapsedProjects={collapsedProjects}
        onCollapsedProjectsChange={setCollapsedProjects}
      />
    </div>
  );
}
