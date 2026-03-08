import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { Issue, Project } from '../types';
import GanttChart from '../components/GanttChart';

export default function GanttAllPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  const loadIssues = useCallback(() => {
    api.get('/gantt/all').then((res) => {
      setProjects(res.data.projects);
      setIssues(res.data.issues);
    });
    api.get('/admin/settings/time').then((res) => {
      setSystemSettings(res.data);
    });
  }, []);

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
        <h1 className="text-2xl font-bold text-slate-800">全プロジェクト ガントチャート</h1>
      </div>
      <GanttChart
        issues={issues}
        projects={projects}
        showProject
        systemSettings={systemSettings}
        onUpdateIssue={handleUpdateIssue}
        onIssueCreated={loadIssues}
        onRelationCreated={handleCreateRelation}
      />
    </div>
  );
}
