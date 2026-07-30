import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Unlink } from 'lucide-react';
import api from '../api/client';
import { Activity, Project } from '../types';
import { formatContactDisplayName } from '../utils/format';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import Combobox from '../components/Combobox';
import type { ProjectOutletContext } from './ProjectDetailPage';

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

type CompanyOption = { id: number; name: string };

export default function ProjectActivitiesPage() {
  const { project, myPermissions } = useOutletContext<ProjectOutletContext>();
  const { user } = useAuth();
  const { canUse } = usePermissions(myPermissions);
  const { canInput } = usePermissions(user?.permissions);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linking, setLinking] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [candidates, setCandidates] = useState<Activity[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const companyOptions: CompanyOption[] = useMemo(() => {
    const map = new Map<number, string>();
    if (project.companyId && project.company) {
      map.set(project.companyId, project.company.name);
    } else if (project.companyId) {
      map.set(project.companyId, `企業 #${project.companyId}`);
    }
    for (const rc of project.relatedCompanies || []) {
      if (rc.companyId) {
        map.set(rc.companyId, rc.company?.name ?? `企業 #${rc.companyId}`);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [project.companyId, project.company, project.relatedCompanies]);

  const canLink = canInput('companies.activities') && companyOptions.length > 0;

  const loadActivities = () => {
    if (!canUse('projects.activities')) return;
    setLoading(true);
    api
      .get<Activity[]>(`/projects/${project.id}/activities`)
      .then((res) => setActivities(res.data))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadActivities();
  }, [project.id]);

  useEffect(() => {
    if (!showModal || !companyId) {
      setCandidates([]);
      return;
    }
    setCandidatesLoading(true);
    api
      .get<Activity[]>('/crm/activities', { params: { companyId: Number(companyId) } })
      .then((res) => {
        setCandidates(
          res.data.filter((a) => !(a.projects || []).some((p) => p.id === project.id)),
        );
      })
      .catch(() => setCandidates([]))
      .finally(() => setCandidatesLoading(false));
  }, [showModal, companyId, project.id]);

  const openLinkModal = () => {
    const defaultCompanyId = companyOptions[0] ? String(companyOptions[0].id) : '';
    setCompanyId(defaultCompanyId);
    setSelectedActivityId('');
    setLinkError('');
    setShowModal(true);
  };

  const handleCompanyChange = (val: string) => {
    setCompanyId(val);
    setSelectedActivityId('');
  };

  const handleLink = async (e: FormEvent) => {
    e.preventDefault();
    setLinkError('');
    if (!selectedActivityId) {
      setLinkError('紐づける活動履歴を選択してください');
      return;
    }
    setLinking(true);
    try {
      await api.post(`/projects/${project.id}/activities`, {
        activityId: Number(selectedActivityId),
      });
      setShowModal(false);
      loadActivities();
    } catch (err: any) {
      setLinkError(err.response?.data?.error || '紐づけに失敗しました');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (activityId: number) => {
    if (!window.confirm('このプロジェクトとの紐づけを解除しますか？')) return;
    try {
      await api.delete(`/projects/${project.id}/activities/${activityId}`);
      loadActivities();
    } catch (err: any) {
      alert(err.response?.data?.error || '紐づけ解除に失敗しました');
    }
  };

  if (!canUse('projects.activities')) {
    return <div className="text-center py-12 text-gray-500">この機能を利用する権限がありません</div>;
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-700">活動履歴</h2>
          {activities.length > 0 && (
            <span className="text-sm text-gray-500">{activities.length} 件</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canInput('companies.activities') && companyOptions.length === 0 && (
            <span className="text-xs text-amber-600">プロジェクト設定で企業を紐づけてください</span>
          )}
          {canInput('companies.activities') && (
            <button
              type="button"
              onClick={openLinkModal}
              disabled={!canLink}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              紐づけ
            </button>
          )}
        </div>
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
                {(a.projects || [])
                  .filter((p) => p.id !== project.id)
                  .map((p) => (
                    <Link
                      key={p.id}
                      to={`/projects/${p.id}`}
                      className="text-xs text-sky-600 hover:underline bg-sky-50 px-1.5 py-0.5 rounded"
                    >
                      🗂 {p.name}
                    </Link>
                  ))}
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
            {canInput('companies.activities') && (
              <button
                type="button"
                onClick={() => handleUnlink(a.id)}
                className="shrink-0 p-1.5 text-gray-400 hover:text-red-600 rounded"
                title="紐づけ解除"
              >
                <Unlink className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {activities.length === 0 && (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
            このプロジェクトに紐づく活動履歴がありません
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="活動履歴の紐づけ"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
            >
              キャンセル
            </button>
            <button
              type="submit"
              form="project-activity-link-form"
              disabled={linking || !selectedActivityId}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {linking ? '紐づけ中...' : '紐づけ'}
            </button>
          </>
        }
      >
        {linkError && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{linkError}</div>
        )}
        <form id="project-activity-link-form" onSubmit={handleLink} className="space-y-4">
          {companyOptions.length > 1 ? (
            <Combobox
              label="企業 *"
              value={companyId}
              options={companyOptions.map((c) => ({ value: String(c.id), label: c.name }))}
              onChange={handleCompanyChange}
            />
          ) : companyOptions.length === 1 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">企業</label>
              <p className="text-sm text-slate-700">{companyOptions[0].name}</p>
            </div>
          ) : null}
          <Combobox
            label="活動履歴 *"
            value={selectedActivityId}
            options={candidates.map((a) => ({
              value: String(a.id),
              label: `${getActivityIcon(a.type)} ${a.subject}${(a.projects || []).length > 0 ? `（他 ${a.projects!.length} 件紐づき）` : ''}`,
            }))}
            onChange={setSelectedActivityId}
            disabled={candidatesLoading || !companyId}
          />
          {candidatesLoading && (
            <p className="text-xs text-gray-500">候補を読み込み中...</p>
          )}
          {!candidatesLoading && companyId && candidates.length === 0 && (
            <p className="text-xs text-gray-500">紐づけ可能な活動履歴がありません</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
