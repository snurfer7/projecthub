import { useState, useEffect, Fragment } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Pencil, Trash2, Check, X, Shield, Users, ChevronRight } from 'lucide-react';
import api from '../api/client';
import { Project, ProjectMember, ProjectGroup, Role, Group, ProjectMemberRole } from '../types';
import ConfirmationModal from '../components/ConfirmationModal';
import Combobox from '../components/Combobox';


interface ProjectContext {
    project: Project;
    loadProject: () => void;
    openSettings: () => void;
}

export default function ProjectOverview() {
    const { project, loadProject, openSettings } = useOutletContext<ProjectContext>();

    const [roles, setRoles] = useState<Role[]>([]);
    const [allGroups, setAllGroups] = useState<Group[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);

    // Add form state
    const [selectedPrincipals, setSelectedPrincipals] = useState<Set<string>>(new Set()); // "u:1" or "g:1"
    const [selectedRoleIds, setSelectedRoleIds] = useState<Set<number>>(new Set());
    const [addError, setAddError] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    // Inline edit states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingRoleIds, setEditingRoleIds] = useState<Set<number>>(new Set());

    // Expanded groups (default: all expanded)
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState<{ type: 'member' | 'group'; id: number; name: string; data?: any } | null>(null);

    useEffect(() => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            (project.groups || []).forEach((pg: ProjectGroup) => next.add(pg.groupId));
            return next;
        });
    }, [project.groups]);

    useEffect(() => {
        api.get('/projects/roles/available').then((res) => {
            setRoles(res.data);
            if (res.data.length > 0) setSelectedRoleIds(new Set([res.data[0].id]));
        }).catch(() => { });
        api.get('/admin/groups').then((res) => setAllGroups(res.data)).catch(() => { });
        api.get('/issues/meta/options').then((res) => setAllUsers(res.data.users)).catch(() => { });
    }, []);

    // ── Derived sets ──────────────────────────────────────────────────────────
    const assignedGroupIds = new Set((project.groups || []).map((pg: ProjectGroup) => pg.groupId));

    // Users who belong to any assigned group
    const allGroupUserIds = new Set(
        (project.groups || []).flatMap((pg: ProjectGroup) =>
            ((pg.group as any)?.members || []).map((gm: any) => gm.userId)
        )
    );

    // Individual members = project members who are NOT in any group (includes those with no roles)
    const individualMembers = (project.members || []).filter((m: ProjectMember) =>
        !allGroupUserIds.has(m.userId)
    );

    // Selectable groups (not yet assigned)
    const selectableGroups = allGroups.filter((g) => !assignedGroupIds.has(g.id));

    // Selectable users (not yet individually added and not in any assigned group)
    const currentIndividualUserIds = new Set(individualMembers.map(m => m.userId));
    const selectableUsers = allUsers.filter(u => !currentIndividualUserIds.has(u.id) && !allGroupUserIds.has(u.id));

    // ── Toggles ───────────────────────────────────────────────────────────────
    const togglePrincipal = (key: string) => {
        setSelectedPrincipals((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleRole = (roleId: number, isEdit = false) => {
        if (isEdit) {
            setEditingRoleIds((prev) => {
                const next = new Set(prev);
                if (next.has(roleId)) next.delete(roleId);
                else next.add(roleId);
                return next;
            });
        } else {
            setSelectedRoleIds((prev) => {
                const next = new Set(prev);
                if (next.has(roleId)) next.delete(roleId);
                else next.add(roleId);
                return next;
            });
        }
    };

    // ── Add members/groups ────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (selectedPrincipals.size === 0 || selectedRoleIds.size === 0) return;
        setAddError('');
        setAddLoading(true);
        const roleIds = Array.from(selectedRoleIds);
        try {
            for (const key of selectedPrincipals) {
                const [type, id] = key.split(':');
                if (type === 'u') {
                    await api.post(`/projects/${project.id}/members`, { userId: Number(id), roleIds });
                } else {
                    await api.post(`/projects/${project.id}/groups`, { groupId: Number(id), roleIds });
                }
            }
            setSelectedPrincipals(new Set());
            loadProject();
        } catch (err: any) {
            setAddError(err.response?.data?.error || '追加に失敗しました');
        } finally {
            setAddLoading(false);
        }
    };

    // ── Inline role edit ──────────────────────────────────────────────────────
    const startEdit = (key: string, currentRoleIds: number[]) => {
        setEditingId(key);
        setEditingRoleIds(new Set(currentRoleIds));
    };
    const cancelEdit = () => { setEditingId(null); setEditingRoleIds(new Set()); };

    const saveEdit = async (key: string) => {
        const [type, id] = key.split(':');
        try {
            if (type === 'm') {
                await api.put(`/projects/${project.id}/members/${id}`, { roleIds: Array.from(editingRoleIds) });
            } else if (type === 'u') {
                await api.post(`/projects/${project.id}/members`, { userId: Number(id), roleIds: Array.from(editingRoleIds) });
            }
            setEditingId(null);
            loadProject();
        } catch {
            alert('ロールの変更に失敗しました');
        }
    };

    const toggleGroup = (groupId: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
            return next;
        });
    };

    // ── Remove ────────────────────────────────────────────────────────────────
    const handleDeleteMemberIndividual = async (member: ProjectMember) => {
        try {
            await api.delete(`/projects/${project.id}/members/${member.id}`);
            setConfirmDelete(null);
            loadProject();
        } catch { alert('削除に失敗しました'); }
    };

    const handleDeleteGroup = async (pg: ProjectGroup) => {
        try {
            await api.delete(`/projects/${project.id}/groups/${pg.groupId}`);
            setConfirmDelete(null);
            loadProject();
        } catch { alert('削除に失敗しました'); }
    };

    const hasAnything = (project.groups || []).length > 0 || individualMembers.length > 0;

    return (
        <>
            {/* Project Info Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-slate-700">プロジェクト情報</h2>
                    <button onClick={openSettings} className="text-sky-600 hover:text-sky-700 text-sm font-medium flex items-center gap-1">
                        <Pencil className="w-4 h-4" />設定
                    </button>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mb-8">
                        <div><div className="text-gray-500 mb-1">識別子</div><div className="text-slate-800 font-medium">{project.identifier}</div></div>
                        <div><div className="text-gray-500 mb-1">期限日</div><div className="text-slate-800 font-medium">{project.dueDate ? <span className="text-orange-600 font-medium">{new Date(project.dueDate).toLocaleDateString('ja-JP')}</span> : '-'}</div></div>
                        <div />
                    </div>

                    {project.description && (
                        <div className="mb-8">
                            <div className="text-gray-500 text-sm mb-2">説明</div>
                            <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                                {project.description}
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <h3 className="text-md font-semibold text-slate-700 mb-4">企業</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            <div><div className="text-gray-500 mb-1">企業</div><div className="text-slate-800 font-medium">{project.company ? <Link to={`/companies/${project.company.id}`} className="text-sky-600 hover:underline">{project.company.name}</Link> : '-'}</div></div>
                            <div><div className="text-gray-500 mb-1">拠点</div><div className="text-slate-800 font-medium">{project.location?.name || '-'}</div></div>
                            <div><div className="text-gray-500 mb-1">担当者</div><div className="text-slate-800 font-medium">
                                {project.contact ? (
                                    <div className="flex flex-col">
                                        <span>{project.contact.lastName} {project.contact.firstName}</span>
                                        {(project.contact.email || project.contact.phone) && (
                                            <span className="text-[11px] text-gray-400 mt-0.5">
                                                {[project.contact.email, project.contact.phone].filter(Boolean).join(' / ')}
                                            </span>
                                        )}
                                    </div>
                                ) : '-'}
                            </div></div>
                        </div>
                        {project.remarks && (
                            <div className="mt-4 pt-4 border-t border-gray-50/50">
                                <div className="text-gray-500 text-sm mb-2">備考</div>
                                <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                                    {project.remarks}
                                </div>
                            </div>
                        )}
                    </div>

                    {project.relatedCompanies && project.relatedCompanies.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <h3 className="text-md font-semibold text-slate-700 mb-4">関連企業</h3>
                            <div className="space-y-6">
                                {project.relatedCompanies.map((rc, index) => (
                                    <div key={rc.id || index} className="bg-gray-50/50 rounded-lg p-4 border border-gray-100">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                                            <div><div className="text-gray-500 mb-1 text-[11px] uppercase tracking-wider">企業</div><div className="text-slate-800 font-medium">{rc.company ? <Link to={`/companies/${rc.company.id}`} className="text-sky-600 hover:underline">{rc.company.name}</Link> : '-'}</div></div>
                                            <div><div className="text-gray-500 mb-1 text-[11px] uppercase tracking-wider">拠点</div><div className="text-slate-800 font-medium">{rc.location?.name || '-'}</div></div>
                                            <div><div className="text-gray-500 mb-1 text-[11px] uppercase tracking-wider">担当者</div><div className="text-slate-800 font-medium">
                                                {rc.contact ? (
                                                    <div className="flex flex-col">
                                                        <span>{rc.contact.lastName} {rc.contact.firstName}</span>
                                                        {(rc.contact.email || rc.contact.phone) && (
                                                            <span className="text-[11px] text-gray-400 mt-0.5">
                                                                {[rc.contact.email, rc.contact.phone].filter(Boolean).join(' / ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : '-'}
                                            </div></div>
                                        </div>
                                        {rc.remarks && (
                                            <div className="mt-4 pt-3 border-t border-gray-200/50">
                                                <div className="text-gray-500 text-[11px] mb-1 uppercase tracking-wider">備考</div>
                                                <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                                                    {rc.remarks}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Members Section (Refined Redmine Style) */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-slate-700">メンバー</h2>
                </div>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="flex gap-0 divide-x flex-col md:flex-row">
                        {/* Table Column */}
                        <div className="flex-1 overflow-x-auto">
                            {!hasAnything ? (
                                <p className="px-6 py-8 text-sm text-center text-gray-400">メンバーがいません</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
                                            <th className="text-left px-4 py-3 font-medium text-gray-600">ロール</th>
                                            <th className="w-10 px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {/* Groups (tree) */}
                                        {(project.groups || []).map((pg: ProjectGroup) => {
                                            const groupMembers: any[] = (pg.group as any)?.members || [];
                                            const isExpanded = expandedGroups.has(pg.groupId);
                                            return (
                                                <Fragment key={`g-${pg.groupId}`}>
                                                    {/* Group header row */}
                                                    <tr className="bg-indigo-50/40 border-b border-indigo-100/60">
                                                        <td className="px-4 py-2.5" colSpan={2}>
                                                            <div className="flex items-center gap-2">
                                                                <button type="button" onClick={() => toggleGroup(pg.groupId)} className="p-0.5 rounded hover:bg-indigo-100 text-indigo-400 transition-colors">
                                                                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                                </button>
                                                                <Users className="w-4 h-4 text-indigo-500" />
                                                                <span className="font-semibold text-slate-700 text-sm">{pg.group.name}</span>
                                                                <span className="text-xs text-gray-400">({groupMembers.length}名)</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <button onClick={() => setConfirmDelete({ type: 'group', id: pg.groupId, name: pg.group.name, data: pg })} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        </td>
                                                    </tr>
                                                    {/* Group member rows */}
                                                    {isExpanded && groupMembers.map((gm: any, idx: number) => {
                                                        const pm = (project.members || []).find(m => m.userId === gm.userId);
                                                        const mKey = pm ? `m:${pm.id}` : `u:${gm.userId}`;
                                                        const indivRoles = pm?.roles.filter(r => !r.sourceGroupId) || [];
                                                        const indivRoleIds = indivRoles.map(r => r.roleId);
                                                        const isLast = idx === groupMembers.length - 1;
                                                        return (
                                                            <tr key={`gm-${pg.groupId}-${gm.userId}`} className="hover:bg-gray-50/80">
                                                                <td className="py-2 pl-10 pr-4">
                                                                    <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                                                                        <span className="text-gray-300 select-none text-xs font-mono">{isLast ? '└' : '├'}</span>
                                                                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                                                                            {gm.user.lastName[0]}{gm.user.firstName[0]}
                                                                        </div>
                                                                        {gm.user.lastName} {gm.user.firstName}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    {editingId === mKey ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <Combobox
                                                                                options={roles.map(r => ({ value: r.id, label: r.name }))}
                                                                                value={Array.from(editingRoleIds)}
                                                                                onChange={(vals: number[]) => setEditingRoleIds(new Set(vals))}
                                                                                placeholder="ロールを選択..."
                                                                                isMulti
                                                                                isSearchable={false}
                                                                                showFloatingLabel={false}
                                                                                size="small"
                                                                                className="w-52"
                                                                            />
                                                                            <button onClick={() => saveEdit(mKey)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                                                                            <button onClick={cancelEdit} className="p-1 text-gray-500 hover:bg-gray-50 rounded"><X className="w-4 h-4" /></button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-wrap gap-1 items-center">
                                                                            {indivRoles.map(pr => (
                                                                                <span key={pr.id} className="inline-block px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-xs border border-sky-100 cursor-pointer hover:bg-sky-100" onClick={() => startEdit(mKey, indivRoleIds)}>
                                                                                    {pr.role.name}
                                                                                </span>
                                                                            ))}
                                                                            {indivRoles.length === 0 && (
                                                                                <span className="text-gray-300 italic text-xs cursor-pointer" onClick={() => startEdit(mKey, [])}>ロールなし</span>
                                                                            )}
                                                                            <button onClick={() => startEdit(mKey, indivRoleIds)} className="p-0.5 text-gray-400 hover:text-sky-600 rounded bg-gray-50 border border-gray-100 self-center" title="ロールを編集">
                                                                                <Pencil className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2"></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </Fragment>
                                            );
                                        })}

                                        {/* Individual Members */}
                                        {individualMembers.map((m: ProjectMember) => {
                                            const key = `m:${m.id}`;
                                            const indivRoles = m.roles.filter(r => !r.sourceGroupId);
                                            const groupRoles = m.roles.filter(r => r.sourceGroupId !== null);
                                            const indivRoleIds = indivRoles.map(r => r.roleId);

                                            return (
                                                <tr key={key} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 text-slate-800">
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                {m.user.lastName[0]}{m.user.firstName[0]}
                                                            </div>
                                                            {m.user.lastName} {m.user.firstName}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {editingId === key ? (
                                                            <div className="flex items-center gap-2">
                                                                <Combobox
                                                                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                                                                    value={Array.from(editingRoleIds)}
                                                                    onChange={(vals: number[]) => setEditingRoleIds(new Set(vals))}
                                                                    placeholder="ロールを選択..."
                                                                    isMulti
                                                                    isSearchable={false}
                                                                    showFloatingLabel={false}
                                                                    size="small"
                                                                    className="w-52"
                                                                />
                                                                <button onClick={() => saveEdit(key)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                                                                <button onClick={cancelEdit} className="p-1 text-gray-500 hover:bg-gray-50 rounded"><X className="w-4 h-4" /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap items-center gap-1 min-h-[24px]">
                                                                {/* Individual roles */}
                                                                {indivRoles.map(pr => (
                                                                    <span key={pr.id} className="inline-block px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-xs border border-sky-100 cursor-pointer hover:bg-sky-100 transition-colors" onClick={() => startEdit(key, indivRoleIds)}>
                                                                        {pr.role.name}
                                                                    </span>
                                                                ))}
                                                                {/* Group-inherited roles */}
                                                                {groupRoles.map(pr => {
                                                                    const gName = (project.groups || []).find(pg => pg.groupId === pr.sourceGroupId)?.group.name || 'Group';
                                                                    return (
                                                                        <span key={pr.id} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200 opacity-70" title={`グループ「${gName}」より継承`}>
                                                                            {pr.role.name}
                                                                        </span>
                                                                    );
                                                                })}
                                                                {m.roles.length === 0 && (
                                                                    <span className="text-gray-300 text-xs italic">ロールなし</span>
                                                                )}
                                                                <button onClick={() => startEdit(key, indivRoleIds)} className="p-1 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-all h-fit" title="ロールを編集">
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => setConfirmDelete({ type: 'member', id: m.id, name: `${m.user.lastName} ${m.user.firstName}`, data: m })} className="text-gray-300 hover:text-red-500 transition-colors" title="個別ロールをすべて削除"><X className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Add Form Column (Sidebar) */}
                        <div className="w-full md:w-80 flex-shrink-0 p-5 bg-gray-50/50 border-t md:border-t-0 md:border-l border-gray-100">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> メンバーを追加
                            </p>
                            {addError && <p className="text-xs text-red-600 mb-4 bg-red-50 border border-red-100 rounded-lg p-3 ring-2 ring-red-50">{addError}</p>}

                            {/* Principals List */}
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col mb-5 shadow-sm">
                                <div className="px-3.5 py-2.5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">対象を選択</span>
                                    <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md text-[9px] font-bold text-gray-500">{selectedPrincipals.size}件</span>
                                </div>
                                <div className="overflow-y-auto h-52 divide-y divide-gray-50 text-sm">
                                    {selectableGroups.length > 0 && (
                                        <>
                                            <div className="px-3.5 py-1.5 bg-indigo-50/30 text-[9px] font-bold text-indigo-400 sticky top-0 uppercase tracking-widest backdrop-blur-sm">グループ</div>
                                            {selectableGroups.map(g => (
                                                <label key={`g:${g.id}`} className={`flex items-center gap-3 px-3.5 py-2.5 hover:bg-indigo-50/40 cursor-pointer group transition-colors ${selectedPrincipals.has(`g:${g.id}`) ? 'bg-indigo-50/60' : ''}`}>
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedPrincipals.has(`g:${g.id}`) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-200 bg-white group-hover:border-indigo-300'}`}>
                                                        {selectedPrincipals.has(`g:${g.id}`) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                                                    </div>
                                                    <Users className={`w-4 h-4 ${selectedPrincipals.has(`g:${g.id}`) ? 'text-indigo-500' : 'text-gray-300 group-hover:text-indigo-400'}`} />
                                                    <span className={`text-[13px] ${selectedPrincipals.has(`g:${g.id}`) ? 'text-indigo-700 font-semibold' : 'text-gray-600 group-hover:text-indigo-600'}`}>{g.name}</span>
                                                    <input type="checkbox" className="hidden" checked={selectedPrincipals.has(`g:${g.id}`)} onChange={() => togglePrincipal(`g:${g.id}`)} />
                                                </label>
                                            ))}
                                        </>
                                    )}
                                    <div className="px-3.5 py-1.5 bg-sky-50/30 text-[9px] font-bold text-sky-400 sticky top-0 uppercase tracking-widest backdrop-blur-sm">ユーザー</div>
                                    {selectableUsers.length > 0 ? selectableUsers.map(u => (
                                        <label key={`u:${u.id}`} className={`flex items-center gap-3 px-3.5 py-2.5 hover:bg-sky-50/40 cursor-pointer group transition-colors ${selectedPrincipals.has(`u:${u.id}`) ? 'bg-sky-50/60' : ''}`}>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedPrincipals.has(`u:${u.id}`) ? 'bg-sky-500 border-sky-500' : 'border-gray-200 bg-white group-hover:border-sky-300'}`}>
                                                {selectedPrincipals.has(`u:${u.id}`) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                                            </div>
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${selectedPrincipals.has(`u:${u.id}`) ? 'bg-sky-200 text-sky-700' : 'bg-gray-100 text-gray-400 group-hover:bg-sky-100 group-hover:text-sky-500'}`}>
                                                {u.lastName[0]}{u.firstName[0]}
                                            </div>
                                            <span className={`text-[13px] ${selectedPrincipals.has(`u:${u.id}`) ? 'text-sky-700 font-semibold' : 'text-gray-600 group-hover:text-sky-600'}`}>{u.lastName} {u.firstName}</span>
                                            <input type="checkbox" className="hidden" checked={selectedPrincipals.has(`u:${u.id}`)} onChange={() => togglePrincipal(`u:${u.id}`)} />
                                        </label>
                                    )) : (
                                        <p className="p-5 text-center text-gray-400 text-xs italic">追加可能なユーザーはいません</p>
                                    )}
                                </div>
                            </div>

                            {/* Roles List */}
                            <div className="mb-6">
                                <Combobox
                                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                                    value={Array.from(selectedRoleIds)}
                                    onChange={(vals: number[]) => setSelectedRoleIds(new Set(vals))}
                                    label="ロールを選択"
                                    isMulti
                                    isSearchable={false}
                                />
                            </div>

                            <button
                                onClick={handleAdd}
                                disabled={selectedPrincipals.size === 0 || selectedRoleIds.size === 0 || addLoading}
                                className="w-full relative overflow-hidden group bg-sky-600 text-white text-[13px] font-bold py-3.5 rounded-2xl shadow-lg hover:bg-sky-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100 transition-all duration-200 flex items-center justify-center gap-2.5"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                {addLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>処理中...</span>
                                    </div>
                                ) : (
                                    <><Check className="w-4.5 h-4.5" strokeWidth={3} /> メンバーを追加</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <p className="mt-4 text-xs text-gray-400 leading-relaxed">
                    ※ グループを割り当てると、グループ所属ユーザーがツリー形式で表示されます。<br />
                    ※ 各ユーザーのロールは個別に設定できます。薄いバッジはグループ追加時の初期ロールです。
                </p>
            </div>

            <ConfirmationModal
                isOpen={!!confirmDelete}
                title={confirmDelete?.type === 'group' ? 'グループ割り当て解除' : 'メンバー削除'}
                message={
                    confirmDelete?.type === 'group'
                        ? `グループ「${confirmDelete.name}」の割り当てを解除しますか？\nグループに所属するメンバーもプロジェクトから削除されます。`
                        : `${confirmDelete?.name} の個別ロールを削除しますか？\nグループ由来のロールがある場合はメンバーとして残り続けます。`
                }
                onConfirm={() => {
                    if (!confirmDelete) return;
                    if (confirmDelete.type === 'group') {
                        handleDeleteGroup(confirmDelete.data);
                    } else {
                        handleDeleteMemberIndividual(confirmDelete.data);
                    }
                }}
                onCancel={() => setConfirmDelete(null)}
                variant="danger"
            />
        </>
    );
}
