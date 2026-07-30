import { useState, useEffect } from 'react';
import { useParams, Outlet, useLocation, Link } from 'react-router-dom';
import api from '../api/client';
import { Project, PermissionMap } from '../types';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import Tabs from '../components/Tabs';
import { usePermissions } from '../hooks/usePermissions';

export interface ProjectOutletContext {
  project: Project;
  loadProject: () => void;
  openSettings: () => void;
  myPermissions: PermissionMap;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const location = useLocation();
  const myPermissions = project?.myPermissions ?? {};
  const { canUse, canInput } = usePermissions(myPermissions);

  const loadProject = () => {
    setAccessDenied(false);
    setLoadError(null);
    api
      .get(`/projects/${projectId}`)
      .then((res) => setProject(res.data))
      .catch((err) => {
        setProject(null);
        if (err.response?.status === 403) {
          setAccessDenied(true);
          setLoadError(err.response?.data?.error || 'このプロジェクトを参照する権限がありません');
          return;
        }
        setLoadError(err.response?.data?.error || 'プロジェクトの取得に失敗しました');
      });
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  if (accessDenied) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{loadError || 'このプロジェクトを参照する権限がありません'}</p>
        <Link to="/projects" className="text-blue-600 hover:underline">
          プロジェクト一覧へ戻る
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{loadError}</p>
        <Link to="/projects" className="text-blue-600 hover:underline">
          プロジェクト一覧へ戻る
        </Link>
      </div>
    );
  }

  if (!project) return <div className="text-center py-12 text-gray-500">読み込み中...</div>;

  const tabs = [
    { label: '概要', path: `/projects/${projectId}`, count: undefined as number | undefined },
    ...(canUse('projects.issues')
      ? [{ label: 'チケット', path: `/projects/${projectId}/issues`, count: project._count?.issues }]
      : []),
    ...(canUse('projects.kanban')
      ? [{ label: 'カンバン', path: `/projects/${projectId}/kanban`, count: undefined as number | undefined }]
      : []),
    ...(canUse('projects.gantt')
      ? [{ label: 'ガントチャート', path: `/projects/${projectId}/gantt`, count: undefined as number | undefined }]
      : []),
    ...(canUse('projects.wiki')
      ? [{ label: 'Wiki', path: `/projects/${projectId}/wiki`, count: project._count?.wikiPages }]
      : []),
    ...(canUse('projects.comments')
      ? [{ label: 'コメント', path: `/projects/${projectId}/comments`, count: project._count?.comments }]
      : []),
    ...(canUse('projects.time-entries')
      ? [{ label: '時間記録', path: `/projects/${projectId}/time-entries`, count: project._count?.timeEntries }]
      : []),
    ...(canUse('projects.activities')
      ? [{ label: '活動履歴', path: `/projects/${projectId}/activities`, count: undefined as number | undefined }]
      : []),
  ];

  return (
    <div>
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

      <Tabs tabs={tabs} currentPath={location.pathname} />

      <div>
        <Outlet
          context={{
            project,
            loadProject,
            openSettings: () => setIsSettingsModalOpen(true),
            myPermissions,
          } satisfies ProjectOutletContext}
        />
      </div>

      {isSettingsModalOpen && projectId && canInput('projects.overview') && (
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
