import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Briefcase, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/client';
import { Project, Issue, TimeEntry } from '../types';
import DateInput from './DateInput';

const ACTIVITY_OPTIONS = ['開発', '設計', 'レビュー', 'テスト', 'ドキュメント', 'その他'];

interface TimeRecordTreeProps {
  projects: Project[];
  issues: Issue[];
  timeEntries: TimeEntry[];
  onRefresh: () => void;
}

interface TreeIssue {
  issue: Issue;
  entries: TimeEntry[];
}

interface ProjectNode {
  project: Project;
  depth: number;
  treeIssues: TreeIssue[];
  children: ProjectNode[];
}

export default function TimeRecordTree({ projects, issues, timeEntries, onRefresh }: TimeRecordTreeProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());
  const [collapsedIssues, setCollapsedIssues] = useState<Set<number>>(new Set());

  // New entry state
  const [addingForIssueId, setAddingForIssueId] = useState<number | null>(null);
  const [newEntrySpentOn, setNewEntrySpentOn] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryHours, setNewEntryHours] = useState('');
  const [newEntryActivity, setNewEntryActivity] = useState('開発');
  const [newEntryComments, setNewEntryComments] = useState('');

  // Edit entry state
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editEntrySpentOn, setEditEntrySpentOn] = useState('');
  const [editEntryHours, setEditEntryHours] = useState('');
  const [editEntryActivity, setEditEntryActivity] = useState('開発');
  const [editEntryComments, setEditEntryComments] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const projectTree = useMemo<ProjectNode[]>(() => {
    const projectIds = new Set(projects.map((p) => p.id));
    const filteredIssues = issues.filter((i) => projectIds.has(i.projectId));

    const entriesByIssueId = new Map<number, TimeEntry[]>();
    for (const entry of timeEntries) {
      if (entry.issueId != null) {
        if (!entriesByIssueId.has(entry.issueId)) entriesByIssueId.set(entry.issueId, []);
        entriesByIssueId.get(entry.issueId)!.push(entry);
      }
    }

    const issuesByProjectId = new Map<number, TreeIssue[]>();
    for (const issue of filteredIssues) {
      if (!issuesByProjectId.has(issue.projectId)) issuesByProjectId.set(issue.projectId, []);
      issuesByProjectId.get(issue.projectId)!.push({
        issue,
        entries: entriesByIssueId.get(issue.id) || [],
      });
    }

    const childrenByParentId = new Map<number, Project[]>();
    for (const project of projects) {
      if (project.parentId && projectIds.has(project.parentId)) {
        if (!childrenByParentId.has(project.parentId)) childrenByParentId.set(project.parentId, []);
        childrenByParentId.get(project.parentId)!.push(project);
      }
    }

    function hasContent(projectId: number): boolean {
      if (issuesByProjectId.has(projectId)) return true;
      return (childrenByParentId.get(projectId) || []).some((c) => hasContent(c.id));
    }

    function buildNode(project: Project, depth: number): ProjectNode | null {
      const children = (childrenByParentId.get(project.id) || [])
        .map((c) => buildNode(c, depth + 1))
        .filter((n): n is ProjectNode => n !== null);
      const treeIssues = issuesByProjectId.get(project.id) || [];
      if (treeIssues.length === 0 && children.length === 0) return null;
      return { project, depth, treeIssues, children };
    }

    const rootProjects = projects.filter((p) => !p.parentId || !projectIds.has(p.parentId));
    return rootProjects
      .filter((p) => hasContent(p.id))
      .map((p) => buildNode(p, 0))
      .filter((n): n is ProjectNode => n !== null);
  }, [projects, issues, timeEntries]);

  const toggleProject = (id: number) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleIssue = (id: number) => {
    const isCurrentlyCollapsed = collapsedIssues.has(id);
    setCollapsedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!isCurrentlyCollapsed && addingForIssueId === id) setAddingForIssueId(null);
  };

  const startAdding = (issueId: number) => {
    setEditingEntryId(null);
    setAddingForIssueId(issueId);
    setNewEntrySpentOn(new Date().toISOString().split('T')[0]);
    setNewEntryHours('');
    setNewEntryActivity('開発');
    setNewEntryComments('');
    setCollapsedIssues((prev) => {
      const next = new Set(prev);
      next.delete(issueId);
      return next;
    });
  };

  const startEditing = (entry: TimeEntry) => {
    setAddingForIssueId(null);
    setEditingEntryId(entry.id);
    setEditEntrySpentOn(entry.spentOn.split('T')[0]);
    setEditEntryHours(String(entry.hours));
    setEditEntryActivity(entry.activity);
    setEditEntryComments(entry.comments || '');
  };

  const handleAddConfirm = async (issueId: number, projectId: number) => {
    if (!newEntryHours || Number(newEntryHours) <= 0) {
      alert('時間を入力してください');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/time-entries', {
        projectId,
        issueId,
        hours: Number(newEntryHours),
        activity: newEntryActivity,
        spentOn: newEntrySpentOn,
        comments: newEntryComments || undefined,
      });
      setAddingForIssueId(null);
      onRefresh();
    } catch (e: any) {
      alert('保存に失敗しました: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditConfirm = async () => {
    if (!editEntryHours || Number(editEntryHours) <= 0) {
      alert('時間を入力してください');
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/time-entries/${editingEntryId}`, {
        hours: Number(editEntryHours),
        activity: editEntryActivity,
        spentOn: editEntrySpentOn,
        comments: editEntryComments || undefined,
      });
      setEditingEntryId(null);
      onRefresh();
    } catch (e: any) {
      alert('保存に失敗しました: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm('この時間記録を削除しますか？')) return;
    try {
      await api.delete(`/time-entries/${entryId}`);
      onRefresh();
    } catch (e: any) {
      alert('削除に失敗しました: ' + (e.response?.data?.error || e.message));
    }
  };

  const renderProjectNode = (node: ProjectNode): React.ReactNode[] => {
    const { project, depth, treeIssues, children } = node;
    const isCollapsed = collapsedProjects.has(project.id);
    const totalHours = calcChildHours(node);

    const rows: React.ReactNode[] = [];

    rows.push(
      <tr key={`p-${project.id}`} className="bg-slate-50 border-t">
        <td className="py-2 pr-1 text-center" style={{ paddingLeft: depth * 16 + 6 }}>
          <button onClick={() => toggleProject(project.id)} className="text-gray-500 hover:text-gray-700">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            {depth > 0 && <span className="text-gray-300 select-none">{'└'}</span>}
            <Briefcase size={13} className="text-sky-500 shrink-0" />
            <span className="font-semibold text-gray-700">{project.name}</span>
          </div>
        </td>
        <td></td>
        <td></td>
        <td></td>
        <td className="px-3 py-2 text-xs text-gray-500">{totalHours > 0 ? `${totalHours.toFixed(1)}h` : ''}</td>
        <td></td>
        <td></td>
      </tr>,
    );

    if (!isCollapsed) {
      treeIssues.forEach(({ issue, entries }) => {
        const isIssueCollapsed = collapsedIssues.has(issue.id);
        const issueTotalHours = entries.reduce((s, e) => s + e.hours, 0);
        const isAddingHere = addingForIssueId === issue.id;
        const issueIndentPx = depth * 16 + 28;

        rows.push(
          <tr key={`i-${issue.id}`} className="border-t bg-sky-50/40 hover:bg-sky-50/60">
            <td className="py-2 pr-1 text-center" style={{ paddingLeft: issueIndentPx }}>
              <button onClick={() => toggleIssue(issue.id)} className="text-gray-400 hover:text-gray-600">
                {isIssueCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            </td>
            <td className="px-3 py-2">
              <span className="text-gray-400 text-xs mr-1">#{issue.id}</span>
              <span className="text-gray-700">{issue.subject}</span>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td className="px-3 py-2 text-xs text-gray-500">
              {issueTotalHours > 0 ? `${issueTotalHours.toFixed(1)}h` : ''}
            </td>
            <td></td>
            <td className="px-3 py-2">
              <button
                onClick={() => startAdding(issue.id)}
                className="flex items-center gap-0.5 text-xs text-sky-600 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded ml-auto"
              >
                <Plus size={10} />
                記録を追加
              </button>
            </td>
          </tr>,
        );

        if (!isIssueCollapsed) {
          entries.forEach((entry) => {
            const isEditing = editingEntryId === entry.id;

            if (isEditing) {
              // Edit form row
              rows.push(
                <tr key={`e-${entry.id}`} className="border-t bg-amber-50/60">
                  <td></td>
                  <td className="py-1.5 text-xs text-amber-600 font-medium" style={{ paddingLeft: issueIndentPx + 24 }}>
                    編集
                  </td>
                  <td className="px-2 py-1">
                    <DateInput
                      value={editEntrySpentOn}
                      onChange={setEditEntrySpentOn}
                      size="small"
                      showFloatingLabel={false}
                      className="w-28"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-400 whitespace-nowrap">
                    {entry.user.lastName} {entry.user.firstName}
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={editEntryActivity}
                      onChange={(e) => setEditEntryActivity(e.target.value)}
                      className="w-24 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      {ACTIVITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={editEntryHours}
                      onChange={(e) => setEditEntryHours(e.target.value)}
                      step="0.25"
                      min="0.25"
                      placeholder="時間"
                      className="w-16 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={editEntryComments}
                      onChange={(e) => setEditEntryComments(e.target.value)}
                      placeholder="コメント"
                      className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <button
                      onClick={handleEditConfirm}
                      disabled={submitting}
                      className="text-xs bg-sky-600 text-white px-2.5 py-1 rounded hover:bg-sky-700 mr-1 disabled:opacity-50"
                    >
                      確定
                    </button>
                    <button
                      onClick={() => setEditingEntryId(null)}
                      className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-gray-300"
                    >
                      ×
                    </button>
                  </td>
                </tr>,
              );
            } else {
              // Display row
              rows.push(
                <tr key={`e-${entry.id}`} className="border-t bg-white group">
                  <td></td>
                  <td className="px-3 py-1.5 text-gray-400 text-xs" style={{ paddingLeft: issueIndentPx + 24 }}></td>
                  <td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                    {entry.spentOn.split('T')[0]}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                    {entry.user.lastName} {entry.user.firstName}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-600">{entry.activity}</td>
                  <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{entry.hours}h</td>
                  <td className="px-3 py-1.5 text-xs text-gray-500">{entry.comments || ''}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEditing(entry)}
                      className="text-sky-500 hover:text-sky-700 mr-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="編集"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="削除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>,
              );
            }
          });

          // New entry form row
          if (isAddingHere) {
            rows.push(
              <tr key={`new-${issue.id}`} className="border-t bg-white">
                <td></td>
                <td className="py-1.5 text-xs text-sky-500 font-medium" style={{ paddingLeft: issueIndentPx + 24 }}>
                  新規
                </td>
                <td className="px-2 py-1">
                  <DateInput
                    value={newEntrySpentOn}
                    onChange={setNewEntrySpentOn}
                    size="small"
                    showFloatingLabel={false}
                    className="w-28"
                  />
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-400 whitespace-nowrap">（自分）</td>
                <td className="px-2 py-1">
                  <select
                    value={newEntryActivity}
                    onChange={(e) => setNewEntryActivity(e.target.value)}
                    className="w-24 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {ACTIVITY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={newEntryHours}
                    onChange={(e) => setNewEntryHours(e.target.value)}
                    step="0.25"
                    min="0.25"
                    placeholder="時間"
                    className="w-16 border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={newEntryComments}
                    onChange={(e) => setNewEntryComments(e.target.value)}
                    placeholder="コメント"
                    className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </td>
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleAddConfirm(issue.id, project.id)}
                    disabled={submitting}
                    className="text-xs bg-sky-600 text-white px-2.5 py-1 rounded hover:bg-sky-700 mr-1 disabled:opacity-50"
                  >
                    確定
                  </button>
                  <button
                    onClick={() => setAddingForIssueId(null)}
                    className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-gray-300"
                  >
                    ×
                  </button>
                </td>
              </tr>,
            );
          }
        }
      });

      children.forEach((child) => rows.push(...renderProjectNode(child)));
    }

    return rows;
  };

  if (projectTree.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="text-center py-12 text-gray-500">表示するデータがありません</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-2 py-2 w-10"></th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">プロジェクト / チケット</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">日付</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">ユーザー</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">活動</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">時間</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">コメント</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody>{projectTree.flatMap((node) => renderProjectNode(node))}</tbody>
      </table>
    </div>
  );
}

function calcChildHours(node: ProjectNode): number {
  const own = node.treeIssues.reduce((sum, { entries }) => sum + entries.reduce((s, e) => s + e.hours, 0), 0);
  const childTotal = node.children.reduce((sum, c) => sum + calcChildHours(c), 0);
  return own + childTotal;
}
