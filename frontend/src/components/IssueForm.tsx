import { useState, useEffect, FormEvent, useId, useMemo } from 'react';
import api from '../api/client';
import { Issue, IssueMetaOptions, SystemSetting, PermissionMap } from '../types';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import Modal from './Modal';
import MarkdownEditor from './MarkdownEditor';
import AnalogTimePicker from './AnalogTimePicker';
import CustomTimePicker from './CustomTimePicker';
import Combobox from './Combobox';
import TextInput from './TextInput';
import NumberInput from './NumberInput';
import DateInput from './DateInput';
import { formatEstimatedHours } from '../utils/format';
import { getCachedProjectPermissions } from '../utils/projectPermissionsCache';
import { getSelectableStatuses } from '../utils/issueWorkflow';
import { buildGroupedUserOptions } from '../utils/groupedUserOptions';

function toLocalDatetimeString(dateString?: string | null) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

interface IssueFormProps {
    projectId?: string;
    issueId?: string;
    initialStartDate?: string;
    initialEndDate?: string;
    initialDueDate?: string;
    defaultStatusId?: number;
    onSuccess: (issueId: number) => void;
    onCancel: () => void;
    permissions?: PermissionMap;
    /** Modal 内表示時は true。フッターは Modal の footer に出す */
    inModal?: boolean;
    formId?: string;
}

export function IssueFormModalActions({
    formId,
    onCancel,
    isEdit,
    canSave,
}: {
    formId: string;
    onCancel: () => void;
    isEdit: boolean;
    canSave: boolean;
}) {
    return (
        <>
            <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
                キャンセル
            </button>
            <button
                type="submit"
                form={formId}
                disabled={!canSave}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isEdit ? '更新' : '作成'}
            </button>
        </>
    );
}

interface IssueFormModalProps extends IssueFormProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function IssueFormModal({ isOpen, onClose, title, size, ...issueFormProps }: IssueFormModalProps) {
    const formId = useId();
    const [resolvedPermissions, setResolvedPermissions] = useState<PermissionMap | undefined>(issueFormProps.permissions);
    const { canInput } = usePermissions(resolvedPermissions);
    const canSave = canInput('projects.issues');
    const isEdit = !!issueFormProps.issueId;

    useEffect(() => {
        if (!isOpen) return;
        if (issueFormProps.permissions !== undefined) {
            setResolvedPermissions(issueFormProps.permissions);
            return;
        }
        const pid = issueFormProps.projectId ? Number(issueFormProps.projectId) : NaN;
        if (Number.isFinite(pid) && pid > 0) {
            getCachedProjectPermissions(pid)
                .then(setResolvedPermissions)
                .catch(() => setResolvedPermissions({}));
            return;
        }
        if (issueFormProps.issueId) {
            api.get(`/issues/${issueFormProps.issueId}`)
                .then((res) => getCachedProjectPermissions(res.data.projectId))
                .then(setResolvedPermissions)
                .catch(() => setResolvedPermissions({}));
        }
    }, [isOpen, issueFormProps.permissions, issueFormProps.projectId, issueFormProps.issueId]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size={size}
            footer={
                <IssueFormModalActions
                    formId={formId}
                    onCancel={issueFormProps.onCancel}
                    isEdit={isEdit}
                    canSave={canSave}
                />
            }
        >
            <IssueForm {...issueFormProps} permissions={resolvedPermissions} inModal formId={formId} />
        </Modal>
    );
}

export default function IssueForm({
    projectId,
    issueId,
    initialStartDate,
    initialEndDate,
    initialDueDate,
    defaultStatusId,
    onSuccess,
    onCancel,
    permissions,
    inModal,
    formId: formIdProp,
}: IssueFormProps) {
    const isEdit = !!issueId;
    const { user } = useAuth();
    const { canInput, canInputField } = usePermissions(permissions);
    const fieldDisabled = (code: string) => (permissions ? !canInputField(code) : false);
    const canSave = canInput('projects.issues');

    const [meta, setMeta] = useState<IssueMetaOptions | null>(null);
    const [trackerId, setTrackerId] = useState('');
    const [statusId, setStatusId] = useState('');
    const [priorityId, setPriorityId] = useState('');
    const [assignedToPrincipals, setAssignedToPrincipals] = useState<string[]>([]);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(initialStartDate || '');
    const [endDate, setEndDate] = useState(initialEndDate || '');
    const [dueDate, setDueDate] = useState(initialDueDate || '');
    const [estimatedHours, setEstimatedHours] = useState('');
    const [doneRatio, setDoneRatio] = useState('0');
    const [currentProjectId, setCurrentProjectId] = useState(projectId || '');
    const [parentId, setParentId] = useState('');
    const [parentOptions, setParentOptions] = useState<{ id: number; subject: string; parentId?: number | null }[]>([]);
    const [hasChildren, setHasChildren] = useState(false);
    const [originalStatusId, setOriginalStatusId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [systemStartTime, setSystemStartTime] = useState('09:00');
    const [systemEndTime, setSystemEndTime] = useState('18:00');
    const [totalDayConversion, setTotalDayConversion] = useState(0);

    useEffect(() => {
        api.get('/admin/settings/time').then((res) => {
            const data: SystemSetting = res.data;
            setSystemStartTime(data.startTime);
            setSystemEndTime(data.endTime);
            const total = (data.conversionTimes || []).reduce((a, b) => a + b, 0);
            setTotalDayConversion(total);

            if (!isEdit) {
                let resolvedStartDate = '';
                if (!initialStartDate) {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const today = `${year}-${month}-${day}`;
                    resolvedStartDate = `${today}T${data.startTime}`;
                } else {
                    resolvedStartDate = initialStartDate.includes('T')
                        ? initialStartDate
                        : `${initialStartDate}T${data.startTime}`;
                }
                setStartDate(resolvedStartDate);

                if (initialEndDate) {
                    setEndDate(initialEndDate.includes('T') ? initialEndDate : `${initialEndDate}T${data.endTime}`);
                } else {
                    const startDay = resolvedStartDate.slice(0, 10);
                    setEndDate(`${startDay}T${data.endTime}`);
                }

                if (initialDueDate) {
                    setDueDate(initialDueDate);
                }
            }
        }).catch(() => { });
    }, [isEdit, initialStartDate, initialEndDate, initialDueDate]);

    useEffect(() => {
        api.get('/issues/meta/options', { params: { projectId: currentProjectId } }).then((res) => {
            setMeta(res.data);
            if (!isEdit && res.data.trackers.length > 0) setTrackerId(String(res.data.trackers[0].id));
            if (!isEdit) {
                const selectable = getSelectableStatuses(res.data.statuses, res.data.workflow, { mode: 'create' });
                if (selectable.length > 0) {
                    const preferred = defaultStatusId != null
                        ? selectable.find((s) => s.id === defaultStatusId)
                        : undefined;
                    setStatusId(String(preferred?.id ?? selectable[0].id));
                } else {
                    setStatusId('');
                }
            }
            if (!isEdit && res.data.priorities.length > 0) {
                const normal = res.data.priorities.find((p: any) => p.name === '通常');
                setPriorityId(String(normal?.id || res.data.priorities[0].id));
            }
            if (!isEdit && user) {
                const inCandidates = (res.data.users || []).some(
                    (u: { id: number; status?: string }) => u.id === user.id && u.status === 'active'
                );
                setAssignedToPrincipals(inCandidates ? [`u:${user.id}`] : []);
            }
        }).catch((err) => {
            setError('メタデータの取得に失敗しました');
            setMeta({ trackers: [], statuses: [], priorities: [], users: [] });
        });
    }, [isEdit, currentProjectId, defaultStatusId, user?.id]);

    useEffect(() => {
        if (!currentProjectId) {
            setParentOptions([]);
            return;
        }
        api.get('/issues', { params: { projectId: currentProjectId } }).then((res) => {
            const list: Issue[] = res.data || [];
            setParentOptions(list.map((i) => ({ id: i.id, subject: i.subject, parentId: i.parentId })));
        }).catch(() => setParentOptions([]));
    }, [currentProjectId]);

    useEffect(() => {
        if (isEdit) {
            api.get(`/issues/${issueId}`).then((res) => {
                const issue: Issue = res.data;
                setTrackerId(String(issue.trackerId));
                setStatusId(String(issue.statusId));
                setOriginalStatusId(issue.statusId);
                setPriorityId(String(issue.priorityId));
                const principals: string[] = [];
                if (issue.assignedToGroupId) principals.push(`g:${issue.assignedToGroupId}`);
                const users = issue.assignees?.length
                    ? issue.assignees
                    : issue.assignedTo
                        ? [issue.assignedTo]
                        : [];
                for (const u of users) principals.push(`u:${u.id}`);
                setAssignedToPrincipals(principals);
                setSubject(issue.subject);
                setDescription(issue.description || '');
                setStartDate(issue.startDate ? toLocalDatetimeString(issue.startDate) : '');
                setEndDate(issue.endDate ? toLocalDatetimeString(issue.endDate) : '');
                setDueDate(issue.dueDate ? issue.dueDate.slice(0, 10) : '');
                setEstimatedHours(issue.estimatedHours ? String(issue.estimatedHours) : '');
                setDoneRatio(String(issue.doneRatio));
                setCurrentProjectId(String(issue.projectId));
                setParentId(issue.parentId ? String(issue.parentId) : '');
                const childCount = issue.children?.length ?? issue._count?.children ?? 0;
                setHasChildren(childCount > 0);
            }).catch((err) => {
                setError('チケットの取得に失敗しました');
            });
        }
    }, [issueId, isEdit]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const extractedUserIds = assignedToPrincipals
                .filter((p) => p.startsWith('u:'))
                .map((p) => Number(p.slice(2)))
                .filter((n) => Number.isInteger(n) && n > 0);
            const groupPrincipals = assignedToPrincipals.filter((p) => p.startsWith('g:'));
            const extractedGroupId = groupPrincipals.length > 0
                ? Number(groupPrincipals[groupPrincipals.length - 1].slice(2))
                : null;

            if (estimatedHours && !Number.isInteger(Number(estimatedHours))) {
                setError('予定工数は整数で入力してください');
                return;
            }

            const data: any = {
                trackerId: Number(trackerId),
                priorityId: Number(priorityId),
                assignedToIds: extractedUserIds,
                assignedToGroupId: extractedGroupId,
                subject,
                description,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                estimatedHours: estimatedHours ? Math.round(Number(estimatedHours)) : null,
                doneRatio: Number(doneRatio),
            };
            if (!fieldDisabled('projects.issues.fields.parent')) {
                data.parentId = parentId ? Number(parentId) : null;
            }
            if (!hasChildren) {
                data.statusId = Number(statusId);
                data.startDate = startDate ? new Date(startDate).toISOString() : null;
                data.endDate = endDate ? new Date(endDate).toISOString() : null;
            }
            if (!isEdit) data.projectId = Number(currentProjectId);

            if (isEdit) {
                await api.put(`/issues/${issueId}`, data);
                onSuccess(Number(issueId));
            } else {
                const res = await api.post('/issues', data);
                onSuccess(Number(res.data.id));
            }
        } catch (err: any) {
            setError(err.response?.data?.error || '保存に失敗しました');
        }
    };

    const selectableStatuses = useMemo(() => {
        if (!meta) return [];
        return getSelectableStatuses(meta.statuses, meta.workflow, {
            mode: isEdit ? 'edit' : 'create',
            currentStatusId: isEdit ? originalStatusId : (statusId ? Number(statusId) : null),
        });
    }, [meta, isEdit, statusId, originalStatusId]);

    const assigneeOptions = useMemo(() => {
        if (!meta) return [];
        const activeUsers = (meta.users || []).filter(
            (u) => u.status === 'active' || assignedToPrincipals.includes(`u:${u.id}`),
        );
        const groups = (meta.groups || []).map((g) => ({
            id: g.id,
            name: g.name,
            members: g.members ?? [],
        }));
        return buildGroupedUserOptions({
            users: activeUsers,
            groups,
            userValue: (u) => `u:${u.id}`,
            groupHeadersSelectable: true,
        });
    }, [meta, assignedToPrincipals]);

    if (!meta) return <div className="text-center py-12 text-gray-500">読み込み中...</div>;

    const formClassName = inModal ? 'space-y-4' : 'bg-white rounded-lg shadow p-6 space-y-4';
    const scheduleLocked = hasChildren;
    const parentOptionIds = (() => {
        const exclude = new Set<number>();
        if (issueId) {
            const selfId = Number(issueId);
            exclude.add(selfId);
            const byParent = new Map<number | null, number[]>();
            for (const opt of parentOptions) {
                const pid = opt.parentId ?? null;
                const list = byParent.get(pid) ?? [];
                list.push(opt.id);
                byParent.set(pid, list);
            }
            const stack = [...(byParent.get(selfId) ?? [])];
            while (stack.length > 0) {
                const id = stack.pop()!;
                if (exclude.has(id)) continue;
                exclude.add(id);
                stack.push(...(byParent.get(id) ?? []));
            }
        }
        return parentOptions.filter((o) => !exclude.has(o.id));
    })();

    return (
        <div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

            <form
                id={inModal ? formIdProp : undefined}
                onSubmit={handleSubmit}
                className={formClassName}
            >
                <TextInput
                    label="題名 *"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    disabled={fieldDisabled('projects.issues.fields.subject')}
                />

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Combobox
                            label="トラッカー"
                            options={meta.trackers.map((t) => ({ value: String(t.id), label: t.name }))}
                            value={trackerId}
                            onChange={setTrackerId}
                            disabled={fieldDisabled('projects.issues.fields.tracker')}
                        />
                        <Combobox
                            label={scheduleLocked ? 'ステータス（子チケットから算出）' : 'ステータス'}
                            options={selectableStatuses.map((s) => ({ value: String(s.id), label: s.name }))}
                            value={statusId}
                            onChange={setStatusId}
                            disabled={scheduleLocked || fieldDisabled('projects.issues.fields.status')}
                        />
                        <Combobox
                            label="優先度"
                            options={meta.priorities.map((p) => ({ value: String(p.id), label: p.name }))}
                            value={priorityId}
                            onChange={setPriorityId}
                            disabled={fieldDisabled('projects.issues.fields.priority')}
                        />
                        <Combobox
                            label="担当者"
                            options={assigneeOptions}
                            value={assignedToPrincipals}
                            onChange={(val) => {
                                const next = (Array.isArray(val) ? val : [val])
                                    .map(String)
                                    .filter((v) => v && !v.startsWith('__'));
                                const users = next.filter((v) => v.startsWith('u:'));
                                const groups = next.filter((v) => v.startsWith('g:'));
                                // 担当グループは単一（最後に選んだもの）
                                setAssignedToPrincipals([
                                    ...users,
                                    ...(groups.length > 0 ? [groups[groups.length - 1]] : []),
                                ]);
                            }}
                            isMulti
                            disabled={fieldDisabled('projects.issues.fields.assignee')}
                        />
                        <Combobox
                            label="親チケット"
                            options={[
                                { value: '', label: '（なし）' },
                                ...parentOptionIds.map((o) => ({ value: String(o.id), label: `#${o.id} ${o.subject}` })),
                            ]}
                            value={parentId}
                            onChange={setParentId}
                            disabled={fieldDisabled('projects.issues.fields.parent')}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                        <MarkdownEditor value={description} onChange={setDescription} rows={6} disabled={fieldDisabled('projects.issues.fields.description')} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid grid-cols-[1fr_100px] gap-2">
                            <DateInput
                                label={scheduleLocked ? '開始日（子チケットから算出）' : '開始日'}
                                id="start-date"
                                value={startDate ? startDate.slice(0, 10) : ''}
                                onChange={(val) => {
                                    const t = startDate ? startDate.slice(11, 16) : systemStartTime;
                                    setStartDate(val ? `${val}T${t}` : '');
                                }}
                                disabled={scheduleLocked || fieldDisabled('projects.issues.fields.startDateTime')}
                            />
                            <CustomTimePicker
                                label="開始時刻"
                                value={startDate ? startDate.slice(11, 16) : systemStartTime}
                                onChange={(val) => {
                                    const d = startDate ? startDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
                                    setStartDate(`${d}T${val}`);
                                }}
                                disabled={scheduleLocked || !startDate || fieldDisabled('projects.issues.fields.startDateTime')}
                            />
                        </div>
                        <div className="grid grid-cols-[1fr_100px] gap-2">
                            <DateInput
                                label={scheduleLocked ? '終了日（子チケットから算出）' : '終了日'}
                                id="end-date"
                                value={endDate ? endDate.slice(0, 10) : ''}
                                onChange={(val) => {
                                    const t = endDate ? endDate.slice(11, 16) : systemEndTime;
                                    setEndDate(val ? `${val}T${t}` : '');
                                }}
                                disabled={scheduleLocked || fieldDisabled('projects.issues.fields.endDateTime')}
                            />
                            <CustomTimePicker
                                label="終了時刻"
                                value={endDate ? endDate.slice(11, 16) : systemEndTime}
                                onChange={(val) => {
                                    const d = endDate ? endDate.slice(0, 10) : (startDate ? startDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
                                    setEndDate(`${d}T${val}`);
                                }}
                                disabled={scheduleLocked || !endDate || fieldDisabled('projects.issues.fields.endDateTime')}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NumberInput
                            label={`予定工数${totalDayConversion > 0 && estimatedHours ? ` (${formatEstimatedHours(Number(estimatedHours), totalDayConversion)})` : ''}`}
                            value={estimatedHours}
                            onChange={(e) => setEstimatedHours(e.target.value)}
                            step="1"
                            min="0"
                            endAdornment="時間"
                            disabled={fieldDisabled('projects.issues.fields.estimatedHours')}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <DateInput
                            label="期日"
                            id="due-date"
                            value={dueDate}
                            onChange={(val) => setDueDate(val)}
                            disabled={fieldDisabled('projects.issues.fields.dueDate')}
                        />
                        <Combobox
                            label="進捗率 (%)"
                            options={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => ({ value: String(v), label: `${v}%` }))}
                            value={doneRatio}
                            onChange={setDoneRatio}
                            disabled={fieldDisabled('projects.issues.fields.doneRatio')}
                        />
                    </div>
                </div>

                {!inModal && (
                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
                        <button type="submit" disabled={!canSave} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            {isEdit ? '更新' : '作成'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
