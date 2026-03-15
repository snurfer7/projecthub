import { useState, useEffect } from 'react';
import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Project } from '../types';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import Tabs from '../components/Tabs';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const location = useLocation();

  const loadProject = () => {
    api.get(`/projects/${projectId}`).then((res) => setProject(res.data));
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  if (!project) return <div className="text-center py-12 text-gray-500">読み込み中...</div>;

  const tabs = [
    { label: '概要', path: `/projects/${projectId}`, count: undefined },
    { label: 'チケット', path: `/projects/${projectId}/issues`, count: project._count?.issues },
    { label: 'カンバン', path: `/projects/${projectId}/kanban`, count: undefined },
    { label: 'ガントチャート', path: `/projects/${projectId}/gantt`, count: undefined },
    { label: 'Wiki', path: `/projects/${projectId}/wiki`, count: project._count?.wikiPages },
    { label: 'コメント', path: `/projects/${projectId}/comments`, count: project._count?.comments },
    { label: '時間記録', path: `/projects/${projectId}/time-entries`, count: project._count?.timeEntries },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mt-2">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
            {project.status === 'active' ? '有効' : '終了'}
          </span>
        </div>
      </div>


      {/* Tabs */}
      <Tabs tabs={tabs} currentPath={location.pathname} />

      <div>
        <Outlet context={{ project, loadProject, openSettings: () => setIsSettingsModalOpen(true) }} />
      </div>

      {isSettingsModalOpen && projectId && (
        <ProjectSettingsModal
          projectId={Number(projectId)}
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onUpdate={loadProject}
        />
      )}
    </div>
  );
}
