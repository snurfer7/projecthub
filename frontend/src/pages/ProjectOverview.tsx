import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Pencil, Trash2, Check, X, Shield, Users } from 'lucide-react';
import api from '../api/client';
import { Project, ProjectMember, ProjectGroup, Role, Group, ProjectMemberRole } from '../types';

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
    const [editingId, setEditingId] = useState<string | null>(null); // "m:memberId" or "g:groupId"
    const [editingRoleIds, setEditingRoleIds] = useState<Set<number>>(new Set());

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

    // Individual members = anyone who has at least one role with sourceGroupId === null
    const individualMembers = (project.members || []).filter((m: ProjectMember) =>
        m.roles.some((r: ProjectMemberRole) => !r.sourceGroupId)
    );

    // Selectable groups (not yet assigned)
    const selectableGroups = allGroups.filter((g) => !assignedGroupIds.has(g.id));

    // Selectable users (anyone not yet individually added - they can be in groups)
    const currentIndividualUserIds = new Set(individualMembers.map(m => m.userId));
    const selectableUsers = allUsers.filter(u => !currentIndividualUserIds.has(u.id));

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
            } else {
                await api.put(`/projects/${project.id}/groups/${id}/role`, { roleIds: Array.from(editingRoleIds) });
            }
            setEditingId(null);
            loadProject();
        } catch {
            alert('ロールの変更に失敗しました');
        }
    };

    // ── Remove ────────────────────────────────────────────────────────────────
    const handleDeleteMemberIndividual = async (member: ProjectMember) => {
        if (!confirm(`${member.user.lastName} ${member.user.firstName} の個別ロールを削除しますか？\nグループ由来のロールがある場合はメンバーとして残り続けます。`)) return;
        try {
            await api.delete(`/projects/${project.id}/members/${member.id}`);
            loadProject();
        } catch { alert('削除に失敗しました'); }
    };

    const handleDeleteGroup = async (pg: ProjectGroup) => {
        if (!confirm(`グループ「${pg.group.name}」の割り当てを解除しますか？\nグループ経由で追加されたメンバーのロールも削除されます。`)) return;
        try {
            await api.delete(`/projects/${project.id}/groups/${pg.groupId}`);
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div><div className="text-gray-500 mb-1">識別子</div><div className="text-slate-800 font-medium">{project.identifier}</div></div>
                        <div><div className="text-gray-500 mb-1">期限日</div><div className="text-slate-800 font-medium">{project.dueDate ? <span className="text-orange-600 font-medium">{new Date(project.dueDate).toLocaleDateString('ja-JP')}</span> : '-'}</div></div>
                        <div><div className="text-gray-500 mb-1">会社</div><div className="text-slate-800 font-medium">{project.company ? <Link to={`/companies/${project.company.id}`} className="text-sky-600 hover:underline">{project.company.name}</Link> : '-'}</div></div>
                    </div>
                    {project.description && (
                        <div className="mt-6 pt-6 border-t">
                            <div className="text-gray-500 text-sm mb-2">説明</div>
                            <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                                {project.description}
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
                                        {/* Groups */}
                                        {(project.groups || []).map((pg: ProjectGroup) => {
                                            const key = `g:${pg.groupId}`;
                                            const groupRoles = (project.members || [])
                                                .find(m => m.roles.some(r => r.sourceGroupId === pg.groupId))
                                                ?.roles.filter(r => r.sourceGroupId === pg.groupId) || [];
                                            const groupRoleIds = groupRoles.map(r => r.roleId);

                                            return (
                                                <tr key={key} className="hover:bg-indigo-50/30">
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                                                            <Users className="w-4 h-4 text-indigo-500" />
                                                            {pg.group.name}
                                                            <span className="text-xs font-normal text-gray-400 ml-1">({((pg.group as any)?.members || []).length}名)</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {editingId === key ? (
                                                            <div className="bg-white border rounded p-2 shadow-sm z-10 absolute mt-1">
                                                                <div className="space-y-1 mb-2">
                                                                    {roles.map(r => (
                                                                        <label key={r.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                                                                            <input type="checkbox" checked={editingRoleIds.has(r.id)} onChange={() => toggleRole(r.id, true)} className="rounded" />
                                                                            <span className="text-xs">{r.name}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-1 justify-end">
                                                                    <button onClick={() => saveEdit(key)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                                                                    <button onClick={cancelEdit} className="p-1 text-gray-500 hover:bg-gray-50 rounded"><X className="w-4 h-4" /></button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1">
                                                                {groupRoles.length > 0 ? groupRoles.map(pr => (
                                                                    <span key={pr.id} className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-100 cursor-pointer hover:bg-indigo-100" onClick={() => startEdit(key, groupRoleIds)}>
                                                                        {pr.role.name}
                                                                    </span>
                                                                )) : <span className="text-gray-300 italic cursor-pointer" onClick={() => startEdit(key, [])}>ロールなし</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => handleDeleteGroup(pg)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
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
                                                            <div className="bg-white border rounded p-2 shadow-sm z-10 absolute mt-1">
                                                                <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase px-1">個別ロール設定</p>
                                                                <div className="space-y-1 mb-2">
                                                                    {roles.map(r => (
                                                                        <label key={r.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                                                                            <input type="checkbox" checked={editingRoleIds.has(r.id)} onChange={() => toggleRole(r.id, true)} className="rounded" />
                                                                            <span className="text-xs">{r.name}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-1 justify-end">
                                                                    <button onClick={() => saveEdit(key)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                                                                    <button onClick={cancelEdit} className="p-1 text-gray-500 hover:bg-gray-50 rounded"><X className="w-4 h-4" /></button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1">
                                                                {/* Individual roles */}
                                                                {indivRoles.map(pr => (
                                                                    <span key={pr.id} className="inline-block px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-xs border border-sky-100 cursor-pointer hover:bg-sky-100" onClick={() => startEdit(key, indivRoleIds)}>
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
                                                                {m.roles.length === 0 && <span className="text-gray-300 italic cursor-pointer" onClick={() => startEdit(key, [])}>ロールなし</span>}
                                                                <button onClick={() => startEdit(key, indivRoleIds)} className="p-0.5 text-gray-400 hover:text-sky-600 rounded bg-gray-50 border border-gray-100 self-center"><Pencil className="w-3 h-3" /></button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button onClick={() => handleDeleteMemberIndividual(m)} className="text-gray-300 hover:text-red-500 transition-colors" title="個別ロールをすべて削除"><X className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Add Form Column (Sidebar) */}
                        <div className="w-full md:w-72 flex-shrink-0 p-4 bg-gray-50 border-t md:border-t-0 md:border-l">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">メンバーを追加</p>
                            {addError && <p className="text-xs text-red-600 mb-2 bg-red-50 border border-red-200 rounded p-2">{addError}</p>}

                            {/* Principals List */}
                            <div className="bg-white border rounded overflow-hidden flex flex-col mb-4">
                                <div className="p-2 border-b bg-gray-50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">対象の選択</span>
                                    <span className="text-[10px] text-gray-400">{selectedPrincipals.size}件選択中</span>
                                </div>
                                <div className="overflow-y-auto h-48 divide-y text-sm">
                                    {selectableGroups.length > 0 && (
                                        <>
                                            <div className="px-3 py-1 bg-indigo-50/50 text-[10px] font-bold text-indigo-400 sticky top-0 uppercase">グループ</div>
                                            {selectableGroups.map(g => (
                                                <label key={`g:${g.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer group">
                                                    <input type="checkbox" checked={selectedPrincipals.has(`g:${g.id}`)} onChange={() => togglePrincipal(`g:${g.id}`)} className="rounded text-indigo-600" />
                                                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                                                    <span className="text-slate-700 group-hover:text-indigo-700">{g.name}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                    <div className="px-3 py-1 bg-sky-50/50 text-[10px] font-bold text-sky-400 sticky top-0 uppercase">ユーザー</div>
                                    {selectableUsers.length > 0 ? selectableUsers.map(u => (
                                        <label key={`u:${u.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-sky-50 cursor-pointer group">
                                            <input type="checkbox" checked={selectedPrincipals.has(`u:${u.id}`)} onChange={() => togglePrincipal(`u:${u.id}`)} className="rounded text-sky-600" />
                                            <span className="text-slate-700 group-hover:text-sky-700">{u.lastName} {u.firstName}</span>
                                        </label>
                                    )) : (
                                        <p className="p-3 text-center text-gray-400 text-xs">追加可能なユーザーはいません</p>
                                    )}
                                </div>
                            </div>

                            {/* Roles checkboxes */}
                            <div className="bg-white border rounded overflow-hidden flex flex-col mb-4">
                                <div className="p-2 border-b bg-gray-50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">ロールの選択</span>
                                </div>
                                <div className="p-2 space-y-1">
                                    {roles.map(r => (
                                        <label key={r.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                                            <input type="checkbox" checked={selectedRoleIds.has(r.id)} onChange={() => toggleRole(r.id)} className="rounded" />
                                            <Shield className="w-3.5 h-3.5 text-gray-300 group-hover:text-sky-500" />
                                            <span className="text-sm text-slate-700">{r.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleAdd}
                                disabled={selectedPrincipals.size === 0 || selectedRoleIds.size === 0 || addLoading}
                                className="w-full bg-sky-600 text-white text-sm font-medium py-2 rounded shadow-sm hover:bg-sky-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                {addLoading ? '処理中...' : <><Check className="w-4 h-4" /> メンバーを追加</>}
                            </button>
                        </div>
                    </div>
                </div>
                <p className="mt-4 text-xs text-gray-400 leading-relaxed">
                    ※ グループを割り当てると、グループ所属ユーザー全員に同じロールが付与されます。<br />
                    ※ グループ経由で追加されたユーザーにも、個別に別のロールを追加することが可能です。
                </p>
            </div>
        </>
    );
}
