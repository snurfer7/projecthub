import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { Issue, Project } from '../types';
import GanttChart from '../components/GanttChart';
import TicketSearchSection from '../components/TicketSearchSection';

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
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());

  const loadIssues = useCallback(() => {
    api.get(`/gantt/project/${projectId}`).then((res) => {
      setProject(res.data.project);
      setIssues(res.data.issues);
    });
    api.get(`/projects/${projectId}`).then((res) => {
      setProject((prev) => ({ ...(prev ?? res.data), ...res.data, myPermissions: res.data.myPermissions }));
    }).catch(() => {});
    api.get('/settings/calendar').then((res) => {
      setSystemSettings(res.data);
    }).catch(() => {});
  }, [projectId]);

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

  const parentProjectIds = project ? new Set([project.id]) : new Set<number>();

  const collapseAll = useCallback(() => {
    setCollapsedProjects(new Set(parentProjectIds));
  }, [parentProjectIds]);

  const expandAll = useCallback(() => {
    setCollapsedProjects(new Set());
  }, []);

  const resetTicketSearchFilter = useCallback(() => {
    setFilterTrackerIds([]);
    setFilterStatusIds([]);
    setFilterAssignedToIds([]);
    setFilterAssignedToGroupIds([]);
    setFilterAssignedToGroupMemberIds([]);
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
            onResetFilter={resetTicketSearchFilter}
            issueCount={issues.length}
          />
        </div>
      </div>
      <GanttChart
        issues={issues}
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
        filterTrackerIds={filterTrackerIds}
        onFilterTrackerIdsChange={setFilterTrackerIds}
        filterStatusIds={filterStatusIds}
        onFilterStatusIdsChange={setFilterStatusIds}
        filterAssignedToIds={filterAssignedToIds}
        onFilterAssignedToIdsChange={setFilterAssignedToIds}
        filterAssignedToGroupIds={filterAssignedToGroupIds}
        filterAssignedToGroupMemberIds={filterAssignedToGroupMemberIds}
        collapsedProjects={collapsedProjects}
        onCollapsedProjectsChange={setCollapsedProjects}
      />
    </div>
  );
}
