import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { Issue, Project } from '../types';
import GanttChart from '../components/GanttChart';
import ChartTicketSearchSection from '../components/ChartTicketSearchSection';

type ZoomLevel = 'day' | 'month' | 'year';

export default function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const [filterTrackerId, setFilterTrackerId] = useState<number | ''>('');
  const [filterStatusId, setFilterStatusId] = useState<number | ''>('');
  const [filterAssignedToId, setFilterAssignedToId] = useState<number | ''>('');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());

  const loadIssues = useCallback(() => {
    api.get(`/gantt/project/${projectId}`).then((res) => {
      setProject(res.data.project);
      setIssues(res.data.issues);
    });
    api.get('/admin/settings/time').then((res) => {
      setSystemSettings(res.data);
    });
  }, [projectId]);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  const handleUpdateIssue = useCallback(async (id: number, data: { startDate?: string; dueDate?: string }) => {
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

  const parentProjectIds = project ? new Set([project.id]) : new Set();

  const collapseAll = useCallback(() => {
    setCollapsedProjects(new Set(parentProjectIds));
  }, [parentProjectIds]);

  const expandAll = useCallback(() => {
    setCollapsedProjects(new Set());
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-700">ガントチャート</h2>
      </div>
      <div className="flex gap-3 mb-4 items-center">
        <div className="flex-1">
          <ChartTicketSearchSection
            zoom={zoom}
            onZoomChange={setZoom}
            startValue={startValue}
            onStartValueChange={setStartValue}
            endValue={endValue}
            onEndValueChange={setEndValue}
            filterTrackerId={filterTrackerId}
            onFilterTrackerIdChange={setFilterTrackerId}
            filterStatusId={filterStatusId}
            onFilterStatusIdChange={setFilterStatusId}
            filterAssignedToId={filterAssignedToId}
            onFilterAssignedToIdChange={setFilterAssignedToId}
            issueCount={issues.length}
            showProject={false}
            onCollapseAll={collapseAll}
            onExpandAll={expandAll}
          />
        </div>
      </div>
      <GanttChart
        issues={issues}
        projects={project ? [project] : []}
        systemSettings={systemSettings}
        onUpdateIssue={handleUpdateIssue}
        onIssueCreated={loadIssues}
        onRelationCreated={handleCreateRelation}
        zoom={zoom}
        onZoomChange={setZoom}
        startValue={startValue}
        onStartValueChange={setStartValue}
        endValue={endValue}
        onEndValueChange={setEndValue}
        filterTrackerId={filterTrackerId}
        onFilterTrackerIdChange={setFilterTrackerId}
        filterStatusId={filterStatusId}
        onFilterStatusIdChange={setFilterStatusId}
        filterAssignedToId={filterAssignedToId}
        onFilterAssignedToIdChange={setFilterAssignedToId}
        collapsedProjects={collapsedProjects}
        onCollapsedProjectsChange={setCollapsedProjects}
      />
    </div>
  );
}
