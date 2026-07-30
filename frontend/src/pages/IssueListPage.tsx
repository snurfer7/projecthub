import { useState, useEffect, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Users, ChevronRight, ChevronDown } from 'lucide-react';
import api from '../api/client';
import { Issue, IssueMetaOptions, PermissionMap } from '../types';
import { IssueFormModal } from '../components/IssueForm';
import ConfirmationModal from '../components/ConfirmationModal';
import IssueDetailModal from '../components/IssueDetailModal';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import PermissionGate from '../components/PermissionGate';
import Combobox from '../components/Combobox';
import type { ProjectOutletContext } from './ProjectDetailPage';
import { issueAssigneeUsers } from '../utils/issueAssignees';

type TreeDisplayRow = {
  issue: Issue;
  depth: number;
  hasChildren: boolean;
};

function buildTreeDisplayRows(issues: Issue[], collapsedIds: Set<number>): TreeDisplayRow[] {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const childrenMap = new Map<number, Issue[]>();
  for (const issue of issues) {
    if (issue.parentId != null && byId.has(issue.parentId)) {
      const list = childrenMap.get(issue.parentId) ?? [];
      list.push(issue);
      childrenMap.set(issue.parentId, list);
    }
  }
  for (const [, list] of childrenMap) {
    list.sort((a, b) => a.id - b.id);
  }
  const roots = issues
    .filter((i) => i.parentId == null || !byId.has(i.parentId))
    .sort((a, b) => a.id - b.id);

  const result: TreeDisplayRow[] = [];
  const visited = new Set<number>();

  const markDescendantsVisited = (id: number) => {
    for (const child of childrenMap.get(id) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      markDescendantsVisited(child.id);
    }
  };

  const visit = (issue: Issue, depth: number) => {
    if (visited.has(issue.id)) return;
    visited.add(issue.id);
    const children = childrenMap.get(issue.id) ?? [];
    result.push({
      issue,
      depth,
      hasChildren: children.length > 0,
    });
    if (collapsedIds.has(issue.id)) {
      // 折りたたみ中の子孫を orphan フォールバックで再表示しない
      markDescendantsVisited(issue.id);
      return;
    }
    children.forEach((child) => visit(child, depth + 1));
  };

  roots.forEach((root) => visit(root, 0));
  issues.forEach((i) => {
    if (!visited.has(i.id)) visit(i, 0);
  });
  return result;
}

export default function IssueListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const outlet = useOutletContext<ProjectOutletContext | null>();
  const projectPermissions: PermissionMap = outlet?.myPermissions ?? {};
  const { canInput } = usePermissions(projectPermissions);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meta, setMeta] = useState<IssueMetaOptions | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTracker, setFilterTracker] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => new Set());
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [deletingIssueId, setDeletingIssueId] = useState<number | null>(null);

  const fetchIssues = () => {
    const params: Record<string, string | undefined> = { projectId };
    if (filterStatus) params.statusId = filterStatus;
    if (filterTracker) params.trackerId = filterTracker;
    api.get('/issues', { params }).then((res) => setIssues(res.data));
  };

  useEffect(() => {
    api.get('/issues/meta/options').then((res) => setMeta(res.data));
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [projectId, filterStatus, filterTracker]);

  const displayRows = useMemo(
    () => buildTreeDisplayRows(issues, collapsedIds),
    [issues, collapsedIds]
  );

  const toggleCollapse = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/issues/${id}`);
      setDeletingIssueId(null);
      fetchIssues();
    } catch {
      alert('削除に失敗しました');
    }
  };

  const priorityColor = (name: string) => {
    if (name === '今すぐ' || name === '急いで') return 'text-red-600';
    if (name === '高め') return 'text-orange-500';
    return 'text-gray-600';
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-700">チケット一覧</h2>
          <PermissionGate code="projects.issues" action="input" permissions={projectPermissions}>
            <button
              onClick={() => setIsNewIssueModalOpen(true)}
              className="bg-sky-600 text-white px-4 py-2 rounded-md text-sm hover:bg-sky-700 cursor-pointer"
            >
              新規チケット
            </button>
          </PermissionGate>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
          <div>
            <Combobox
              label="ステータス"
              options={[
                { value: '', label: '全て' },
                ...(meta?.statuses || []).map((s) => ({ value: String(s.id), label: s.name })),
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              size="small"
            />
          </div>
          <div>
            <Combobox
              label="トラッカー"
              options={[
                { value: '', label: '全て' },
                ...(meta?.trackers || []).map((t) => ({ value: String(t.id), label: t.name })),
              ]}
              value={filterTracker}
              onChange={setFilterTracker}
              size="small"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">トラッカー</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">題名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">優先度</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">担当者</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">進捗</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ issue, depth, hasChildren }) => (
                <tr key={issue.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{issue.id}</td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{issue.tracker?.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center min-w-0"
                      style={depth > 0 ? { paddingLeft: depth * 20 } : undefined}
                    >
                      <span className="w-5 flex-shrink-0 flex items-center justify-center mr-0.5">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(issue.id)}
                            className="p-0.5 text-gray-500 hover:text-gray-800 rounded"
                            title={collapsedIds.has(issue.id) ? '展開' : '折りたたむ'}
                            aria-expanded={!collapsedIds.has(issue.id)}
                          >
                            {collapsedIds.has(issue.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                        ) : (
                          <span className="w-3.5" />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedIssueId(String(issue.id))}
                        className={`text-sky-600 hover:underline font-medium cursor-pointer text-left truncate min-w-0 ${
                          hasChildren ? 'font-semibold' : ''
                        }`}
                      >
                        {issue.subject}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        issue.status?.isClosed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {issue.status?.name}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-medium ${priorityColor(issue.priority?.name || '')}`}>
                    {issue.priority?.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(() => {
                      const users = issueAssigneeUsers(issue);
                      const hasAny = issue.assignedToGroup || users.length > 0;
                      if (!hasAny) return '-';
                      return (
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                          {issue.assignedToGroup && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-indigo-400" /> {issue.assignedToGroup.name}
                            </span>
                          )}
                          {users.map((u) => (
                            <span key={u.id}>{u.lastName} {u.firstName}</span>
                          ))}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${issue.doneRatio}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{issue.doneRatio}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canInput('projects.issues') && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingIssueId(String(issue.id))}
                          className="text-sky-600 hover:text-sky-800 mr-4 cursor-pointer"
                          title="編集"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingIssueId(issue.id)}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                          title="削除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {issues.length === 0 && (
            <div className="text-center py-8 text-gray-500">チケットがありません</div>
          )}
        </div>

        {editingIssueId && (
          <IssueFormModal
            isOpen={!!editingIssueId}
            onClose={() => setEditingIssueId(null)}
            title="チケット編集"
            issueId={editingIssueId}
            onSuccess={() => {
              setEditingIssueId(null);
              fetchIssues();
            }}
            onCancel={() => setEditingIssueId(null)}
            permissions={projectPermissions}
          />
        )}

        <IssueDetailModal
          isOpen={!!selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
          issueId={selectedIssueId}
          user={user!}
          onEdit={() => {
            setEditingIssueId(String(selectedIssueId));
            setSelectedIssueId(null);
          }}
          onRefresh={fetchIssues}
          permissions={projectPermissions}
        />

        <IssueFormModal
          isOpen={isNewIssueModalOpen}
          onClose={() => setIsNewIssueModalOpen(false)}
          title="新規チケット"
          projectId={projectId}
          onSuccess={() => {
            setIsNewIssueModalOpen(false);
            fetchIssues();
          }}
          onCancel={() => setIsNewIssueModalOpen(false)}
          permissions={projectPermissions}
        />
        <ConfirmationModal
          isOpen={!!deletingIssueId}
          title="チケットの削除"
          message="本当にこのチケットを削除しますか？この操作は取り消せません。"
          onConfirm={() => deletingIssueId && handleDelete(deletingIssueId)}
          onCancel={() => setDeletingIssueId(null)}
          variant="danger"
        />
      </div>
    </>
  );
}
