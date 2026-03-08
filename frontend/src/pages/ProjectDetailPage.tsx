import { useState, useEffect } from 'react';
import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Project } from '../types';
import ProjectSettingsModal from '../components/ProjectSettingsModal';

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
    { label: 'Wiki', path: `/projects/${projectId}/wiki`, count: project._count?.wikiPages },
    { label: 'コメント', path: `/projects/${projectId}/comments`, count: project._count?.comments },
    { label: 'ガントチャート', path: `/projects/${projectId}/gantt`, count: undefined },
    { label: 'ファイル', path: `/projects/${projectId}/files`, count: project._count?.attachments },
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
      <div className="border-b mb-4">
        <div className="flex gap-0">
          {tabs.map((tab) => {
            // Exactly match /projects/:projectId for Overview tab
            const isActive = tab.label === '概要'
              ? location.pathname === tab.path || location.pathname === `${tab.path}/`
              : location.pathname.startsWith(tab.path);

            return (
              <Link key={tab.path} to={tab.path}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${isActive
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                {tab.label} {tab.count !== undefined && <span className="text-xs text-gray-400 ml-1">({tab.count})</span>}
              </Link>
            );
          })}
        </div>
      </div>

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
