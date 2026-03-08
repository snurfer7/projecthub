import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { Issue, Project } from '../types';
import GanttChart from '../components/GanttChart';

export default function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ガントチャート</h1>
      </div>
      <GanttChart
        issues={issues}
        projects={project ? [project] : []}
        systemSettings={systemSettings}
        onUpdateIssue={handleUpdateIssue}
        onIssueCreated={loadIssues}
        onRelationCreated={handleCreateRelation}
      />
    </div>
  );
}
