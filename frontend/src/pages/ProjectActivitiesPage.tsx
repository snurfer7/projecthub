import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import api from '../api/client';
import { Activity, Project } from '../types';
import { formatContactDisplayName } from '../utils/format';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';

interface ProjectContext {
  project: Project;
  loadProject: () => void;
  openSettings: () => void;
}

const ACTIVITY_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'call', label: '電話', icon: '📞' },
  { value: 'email', label: 'メール', icon: '✉️' },
  { value: 'visit', label: '訪問', icon: '🏢' },
  { value: 'meeting', label: '会議', icon: '👥' },
  { value: 'memo', label: 'メモ', icon: '📝' },
  { value: 'lead', label: '引合', icon: '🤝' },
  { value: 'estimate', label: '見積り', icon: '📋' },
  { value: 'inquiry', label: '問合せ', icon: '❓' },
  { value: 'maintenance', label: 'メンテ', icon: '🔧' },
  { value: 'claim', label: 'クレーム', icon: '⚠️' },
];

function getActivityIcon(type: string) {
  return ACTIVITY_TYPES.find((t) => t.value === type)?.icon ?? '📋';
}

function getActivityLabel(type: string) {
  return ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type;
}

export default function ProjectActivitiesPage() {
  const { project } = useOutletContext<ProjectContext>();
  const { user } = useAuth();
  const { canUse } = usePermissions(user?.permissions);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canUse('projects.activities')) return;
    setLoading(true);
    api
      .get<Activity[]>(`/projects/${project.id}/activities`)
      .then((res) => setActivities(res.data))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [project.id]);

  if (!canUse('projects.activities')) {
    return <div className="text-center py-12 text-gray-500">この機能を利用する権限がありません</div>;
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-700">活動履歴</h2>
        {activities.length > 0 && (
          <span className="text-sm text-gray-500">{activities.length} 件</span>
        )}
      </div>

      <div className="space-y-3">
        {activities.map((a) => (
          <div
            key={a.id}
            className={`bg-white rounded-lg shadow px-4 py-3 flex items-start gap-3 ${a.completed ? 'opacity-60' : ''}`}
          >
            <span className="text-xl mt-0.5">{getActivityIcon(a.type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium text-sm ${a.completed ? 'line-through text-gray-400' : 'text-slate-800'}`}>
                  {a.subject}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {getActivityLabel(a.type)}
                </span>
                {a.completed && (
                  <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">完了</span>
                )}
                {a.deal && <span className="text-xs text-indigo-500">📊 {a.deal.name}</span>}
              </div>
              {a.description && (
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.description}</p>
              )}
              <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-2">
                {a.company && (
                  <Link
                    to={`/companies/${a.company.id}?tab=activities`}
                    className="text-sky-600 hover:underline"
                  >
                    🏢 {a.company.name}
                  </Link>
                )}
                <span>
                  自社担当: {a.assignedTo ? `${a.assignedTo.lastName} ${a.assignedTo.firstName}` : '-'}
                </span>
                {a.contact && (
                  <span>先方: {formatContactDisplayName(a.contact.lastName, a.contact.firstName)}</span>
                )}
                <span>
                  登録: {a.user.lastName} {a.user.firstName}
                  {' · '}
                  {new Date(a.createdAt).toLocaleString('ja-JP')}
                </span>
                {a.dueDate && (
                  <span>期限: {new Date(a.dueDate).toLocaleDateString('ja-JP')}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
            このプロジェクトに紐づく活動履歴がありません
          </div>
        )}
      </div>
    </div>
  );
}
