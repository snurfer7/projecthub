import { useState, useMemo, useEffect, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Briefcase, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/client';
import { Project, Issue, TimeEntry, PermissionMap } from '../types';
import DateInput from './DateInput';
import { prefetchProjectPermissions, projectMapCanInput } from '../utils/projectPermissionsCache';
import { orderIssuesHierarchically, type IssueListSort } from '../utils/issueSort';
import { sortSiblingProjects, type ProjectListSort } from '../utils/projectTree';

const ACTIVITY_OPTIONS = ['開発', '設計', 'レビュー', 'テスト', 'ドキュメント', 'その他'];

/** ガントと同程度の行高（コンテンツ 24px + 区切り線 1px） */
const TIME_ROW_CONTENT_HEIGHT = 24;
const TIME_ROW_HEIGHT = TIME_ROW_CONTENT_HEIGHT + 1;
/** 階層の字下げ幅（1段あたり） */
const TIME_INDENT_STEP = 16;
/** ∨マークとプロジェクト名／チケット名の間隔（全角スペース相当） */
const CHEVRON_LABEL_GAP = '1em';

/** ガントと同様: ルート塊末尾は濃い実線、それ以外（プロジェクト↔チケット・チケット間・時間記録行同士）は通常の実線 */
type RowBorderKind = 'root' | 'normal';

function rowBorderStyle(kind: RowBorderKind): { borderBottom: string } {
  if (kind === 'root') return { borderBottom: '1px solid #64748B' };
  return { borderBottom: '1px solid #E5E7EB' };
}

function rowStyle(kind: RowBorderKind, opts?: { form?: boolean; entry?: boolean }): CSSProperties {
  // 時間記録行は従来どおり内容に応じた高さ（固定しない）
  if (opts?.entry || opts?.form) {
    return {
      boxSizing: 'border-box',
      ...rowBorderStyle(kind),
    };
  }
  return {
    height: TIME_ROW_HEIGHT,
    boxSizing: 'border-box',
    ...rowBorderStyle(kind),
  };
}

function projectIndentPx(depth: number): number {
  return depth * TIME_INDENT_STEP + 4;
}

function ticketIndentPx(projectDepth: number, issueDepth: number): number {
  return projectIndentPx(projectDepth) + TIME_INDENT_STEP * (1 + issueDepth);
}

function entryIndentPx(projectDepth: number, issueDepth: number): number {
  return ticketIndentPx(projectDepth, issueDepth) + TIME_INDENT_STEP;
}

interface TimeRecordTreeProps {
  projects: Project[];
  issues: Issue[];
  timeEntries: TimeEntry[];
  onRefresh: () => void;
  /** プロジェクトの複合並び替え（ルート・兄弟間） */
  projectSort?: ProjectListSort[];
  /** プロジェクト配下のチケット並び替え */
  issueSort?: IssueListSort[];
}

interface TreeIssue {
  issue: Issue;
  depth: number;
  hasChildren: boolean;
  entries: TimeEntry[];
}

interface ProjectNode {
  project: Project;
  depth: number;
  treeIssues: TreeIssue[];
  children: ProjectNode[];
}

/** 区切り判定用の平坦行メタ（描画前に境界を決める） */
interface FlatRowMeta {
  /** 所属ルートプロジェクトの depth===0 ノード id */
  rootProjectId: number;
}

export default function TimeRecordTree({ projects, issues, timeEntries, onRefresh, projectSort, issueSort }: TimeRecordTreeProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<number>>(new Set());
  const [collapsedIssues, setCollapsedIssues] = useState<Set<number>>(new Set());
  const [permByProject, setPermByProject] = useState<Record<number, PermissionMap>>({});

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

  useEffect(() => {
    const ids = projects.map((p) => p.id);
    if (ids.length === 0) return;
    let cancelled = false;
    prefetchProjectPermissions(ids).then((maps) => {
      if (!cancelled) setPermByProject(maps);
    });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const canEditTime = (projectId: number) =>
    projectMapCanInput(permByProject[projectId], 'projects.time-entries');

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
    const byProject = new Map<number, Issue[]>();
    for (const issue of filteredIssues) {
      if (!byProject.has(issue.projectId)) byProject.set(issue.projectId, []);
      byProject.get(issue.projectId)!.push(issue);
    }
    for (const [projectId, projectIssues] of byProject) {
      const ordered = orderIssuesHierarchically(projectIssues, issueSort);
      const childIds = new Set(
        projectIssues
          .filter((i) => i.parentId != null && projectIssues.some((p) => p.id === i.parentId))
          .map((i) => i.parentId as number),
      );
      issuesByProjectId.set(
        projectId,
        ordered.map(({ issue, depth }) => ({
          issue,
          depth,
          hasChildren: childIds.has(issue.id),
          entries: entriesByIssueId.get(issue.id) || [],
        })),
      );
    }

    const childrenByParentId = new Map<number, Project[]>();
    for (const project of projects) {
      if (project.parentId && projectIds.has(project.parentId)) {
        if (!childrenByParentId.has(project.parentId)) childrenByParentId.set(project.parentId, []);
        childrenByParentId.get(project.parentId)!.push(project);
      }
    }
    for (const [parentId, list] of childrenByParentId) {
      childrenByParentId.set(parentId, sortSiblingProjects(list, projectSort));
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

    const rootProjects = sortSiblingProjects(
      projects.filter((p) => !p.parentId || !projectIds.has(p.parentId)),
      projectSort,
    );
    return rootProjects
      .filter((p) => hasContent(p.id))
      .map((p) => buildNode(p, 0))
      .filter((n): n is ProjectNode => n !== null);
  }, [projects, issues, timeEntries, projectSort, issueSort]);

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

  const collectFlatMeta = (node: ProjectNode, rootProjectId: number, out: FlatRowMeta[]) => {
    const { project, treeIssues, children } = node;
    out.push({ rootProjectId });
    if (collapsedProjects.has(project.id)) return;

    let skipUntilDepth: number | null = null;
    for (const { issue, depth: issueDepth, entries } of treeIssues) {
      if (skipUntilDepth != null) {
        if (issueDepth > skipUntilDepth) continue;
        skipUntilDepth = null;
      }
      out.push({ rootProjectId });
      if (collapsedIssues.has(issue.id)) {
        skipUntilDepth = issueDepth;
        continue;
      }
      for (const _entry of entries) {
        out.push({ rootProjectId });
      }
      if (addingForIssueId === issue.id) {
        out.push({ rootProjectId });
      }
    }
    for (const child of children) {
      collectFlatMeta(child, rootProjectId, out);
    }
  };

  const flatMeta = useMemo(() => {
    const out: FlatRowMeta[] = [];
    for (const node of projectTree) {
      collectFlatMeta(node, node.project.id, out);
    }
    return out;
  }, [projectTree, collapsedProjects, collapsedIssues, addingForIssueId]);

  const borderForIndex = (index: number): RowBorderKind => {
    const current = flatMeta[index];
    const next = flatMeta[index + 1] ?? null;
    if (!next || next.rootProjectId !== current.rootProjectId) return 'root';
    return 'normal';
  };

  const renderProjectNode = (node: ProjectNode, metaOffset: { i: number }): ReactNode[] => {
    const { project, depth, treeIssues, children } = node;
    const isCollapsed = collapsedProjects.has(project.id);
    const totalHours = calcChildHours(node);
    const rows: ReactNode[] = [];

    const takeBorder = () => {
      const border = borderForIndex(metaOffset.i);
      metaOffset.i += 1;
      return border;
    };

    rows.push(
      <tr key={`p-${project.id}`} className="bg-slate-50 text-xs" style={rowStyle(takeBorder())}>
        <td className="pr-2 align-middle" style={{ paddingLeft: projectIndentPx(depth) }}>
          <div className="flex items-center min-w-0" style={{ gap: CHEVRON_LABEL_GAP }}>
            <button
              onClick={() => toggleProject(project.id)}
              className="text-gray-500 hover:text-gray-700 inline-flex items-center flex-shrink-0"
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
            <div className="flex items-center gap-1 min-w-0">
              {depth > 0 && <span className="text-gray-300 select-none flex-shrink-0">└</span>}
              <Briefcase size={12} className="text-sky-500 shrink-0" />
              <span className="font-semibold text-gray-700 truncate">
                {project.company?.name && <span className="text-slate-500 font-normal">{project.company.name} / </span>}
                {project.name}
              </span>
            </div>
          </div>
        </td>
        <td></td>
        <td></td>
        <td></td>
        <td className="px-2 align-middle text-gray-500">{totalHours > 0 ? `${totalHours.toFixed(1)}h` : ''}</td>
        <td></td>
        <td></td>
      </tr>,
    );

    if (!isCollapsed) {
      let skipUntilDepth: number | null = null;
      treeIssues.forEach(({ issue, depth: issueDepth, hasChildren, entries }) => {
        if (skipUntilDepth != null) {
          if (issueDepth > skipUntilDepth) return;
          skipUntilDepth = null;
        }

        const isIssueCollapsed = collapsedIssues.has(issue.id);
        const issueTotalHours = entries.reduce((s, e) => s + e.hours, 0);
        const isAddingHere = addingForIssueId === issue.id;
        const ticketPad = ticketIndentPx(depth, issueDepth);
        const entryPad = entryIndentPx(depth, issueDepth);
        const canCollapse = hasChildren || entries.length > 0 || isAddingHere;

        rows.push(
          <tr key={`i-${issue.id}`} className="bg-sky-50/40 hover:bg-sky-50/60 text-xs" style={rowStyle(takeBorder())}>
            <td className="pr-2 align-middle" style={{ paddingLeft: ticketPad }}>
              <div className="flex items-center min-w-0" style={{ gap: CHEVRON_LABEL_GAP }}>
                {canCollapse ? (
                  <button
                    onClick={() => toggleIssue(issue.id)}
                    className="text-gray-400 hover:text-gray-600 inline-flex items-center flex-shrink-0"
                  >
                    {isIssueCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  </button>
                ) : (
                  <span className="inline-flex w-[11px] flex-shrink-0" />
                )}
                <span className="truncate flex items-center gap-1 min-w-0">
                  {issueDepth > 0 && <span className="text-gray-300 select-none flex-shrink-0">└</span>}
                  <span className="text-gray-400 flex-shrink-0">#{issue.id}</span>
                  <span className={`text-gray-700 truncate ${hasChildren ? 'font-semibold' : ''}`}>{issue.subject}</span>
                  {!issue.startDate && !issue.endDate && (
                    <span className="text-gray-400 text-[10px] flex-shrink-0 whitespace-nowrap">日付未設定</span>
                  )}
                </span>
              </div>
            </td>
            <td></td>
            <td></td>
            <td></td>
            <td className="px-2 align-middle text-gray-500">
              {issueTotalHours > 0 ? `${issueTotalHours.toFixed(1)}h` : ''}
            </td>
            <td></td>
            <td className="px-2 align-middle">
              {canEditTime(project.id) && (
              <button
                onClick={() => startAdding(issue.id)}
                className="flex items-center gap-0.5 text-[11px] leading-none text-sky-600 bg-sky-50 hover:bg-sky-100 px-1.5 py-0.5 rounded ml-auto"
              >
                <Plus size={10} />
                記録を追加
              </button>
              )}
            </td>
          </tr>,
        );

        if (isIssueCollapsed) {
          skipUntilDepth = issueDepth;
          return;
        }

        entries.forEach((entry) => {
          const isEditing = editingEntryId === entry.id;

          if (isEditing) {
            rows.push(
              <tr key={`e-${entry.id}`} className="bg-amber-50/60 text-xs" style={rowStyle(takeBorder(), { form: true })}>
                <td className="py-1.5 text-amber-600 font-medium align-middle" style={{ paddingLeft: entryPad }}>
                  編集
                </td>
                <td className="px-2 py-1 align-middle">
                  <DateInput
                    value={editEntrySpentOn}
                    onChange={setEditEntrySpentOn}
                    size="small"
                    showFloatingLabel={false}
                    className="w-28"
                  />
                </td>
                <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap align-middle">
                  {entry.user.lastName} {entry.user.firstName}
                </td>
                <td className="px-2 py-1 align-middle">
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
                <td className="px-2 py-1 align-middle">
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
                <td className="px-2 py-1 align-middle">
                  <input
                    type="text"
                    value={editEntryComments}
                    onChange={(e) => setEditEntryComments(e.target.value)}
                    placeholder="コメント"
                    className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </td>
                <td className="px-2 py-1 text-right whitespace-nowrap align-middle">
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
            rows.push(
              <tr key={`e-${entry.id}`} className="bg-white group text-xs" style={rowStyle(takeBorder(), { entry: true })}>
                <td className="align-middle" style={{ paddingLeft: entryPad }}></td>
                <td className="px-3 py-1.5 align-middle text-gray-600 whitespace-nowrap">
                  {entry.spentOn.split('T')[0]}
                </td>
                <td className="px-3 py-1.5 align-middle text-gray-600 whitespace-nowrap">
                  {entry.user.lastName} {entry.user.firstName}
                </td>
                <td className="px-3 py-1.5 align-middle text-gray-600">{entry.activity}</td>
                <td className="px-3 py-1.5 align-middle font-medium text-gray-700">{entry.hours}h</td>
                <td className="px-3 py-1.5 align-middle text-gray-500 truncate">{entry.comments || ''}</td>
                <td className="px-3 py-1.5 align-middle text-right whitespace-nowrap">
                  {canEditTime(project.id) && (
                  <>
                  <button
                    onClick={() => startEditing(entry)}
                    className="text-sky-500 hover:text-sky-700 mr-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer inline-flex"
                    title="編集"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer inline-flex"
                    title="削除"
                  >
                    <Trash2 size={13} />
                  </button>
                  </>
                  )}
                </td>
              </tr>,
            );
          }
        });

        if (isAddingHere) {
          rows.push(
            <tr key={`new-${issue.id}`} className="bg-white text-xs" style={rowStyle(takeBorder(), { form: true })}>
              <td className="py-1.5 text-sky-500 font-medium align-middle" style={{ paddingLeft: entryPad }}>
                新規
              </td>
              <td className="px-2 py-1 align-middle">
                <DateInput
                  value={newEntrySpentOn}
                  onChange={setNewEntrySpentOn}
                  size="small"
                  showFloatingLabel={false}
                  className="w-28"
                />
              </td>
              <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap align-middle">（自分）</td>
              <td className="px-2 py-1 align-middle">
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
              <td className="px-2 py-1 align-middle">
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
              <td className="px-2 py-1 align-middle">
                <input
                  type="text"
                  value={newEntryComments}
                  onChange={(e) => setNewEntryComments(e.target.value)}
                  placeholder="コメント"
                  className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </td>
              <td className="px-2 py-1 text-right whitespace-nowrap align-middle">
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
      });

      children.forEach((child) => rows.push(...renderProjectNode(child, metaOffset)));
    }

    return rows;
  };

  const grandTotalHours = useMemo(
    () => projectTree.reduce((sum, node) => sum + calcChildHours(node), 0),
    [projectTree],
  );

  if (projectTree.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="text-center py-12 text-gray-500">表示するデータがありません</div>
      </div>
    );
  }

  const metaOffset = { i: 0 };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-50" style={{ borderBottom: '1px solid #64748B' }}>
          <tr style={{ height: TIME_ROW_HEIGHT, boxSizing: 'border-box' }}>
            <th className="text-left px-2 font-medium text-gray-600">プロジェクト / チケット</th>
            <th className="text-left px-2 font-medium text-gray-600 w-28">日付</th>
            <th className="text-left px-2 font-medium text-gray-600 w-28">ユーザー</th>
            <th className="text-left px-2 font-medium text-gray-600 w-24">活動</th>
            <th className="text-left px-2 font-medium text-gray-600 w-16">時間</th>
            <th className="text-left px-2 font-medium text-gray-600">コメント</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody>
          {projectTree.flatMap((node) => renderProjectNode(node, metaOffset))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100" style={{ height: TIME_ROW_HEIGHT, boxSizing: 'border-box' }}>
            <td className="px-2 font-semibold text-gray-700 align-middle">合計</td>
            <td></td>
            <td></td>
            <td></td>
            <td className="px-2 font-semibold text-gray-800 whitespace-nowrap align-middle">
              {grandTotalHours.toFixed(1)}h
            </td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function calcChildHours(node: ProjectNode): number {
  const own = node.treeIssues.reduce((sum, { entries }) => sum + entries.reduce((s, e) => s + e.hours, 0), 0);
  const childTotal = node.children.reduce((sum, c) => sum + calcChildHours(c), 0);
  return own + childTotal;
}
