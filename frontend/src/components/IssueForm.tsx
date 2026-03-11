import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { Issue, IssueMetaOptions, SystemSetting } from '../types';
import MarkdownEditor from './MarkdownEditor';
import AnalogTimePicker from './AnalogTimePicker';
import Combobox from './Combobox';
import TextInput from './TextInput';
import NumberInput from './NumberInput';
import { formatEstimatedHours } from '../utils/format';

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
    initialDueDate?: string;
    defaultStatusId?: number;
    onSuccess: (issueId: number) => void;
    onCancel: () => void;
}

export default function IssueForm({ projectId, issueId, initialStartDate, initialDueDate, defaultStatusId, onSuccess, onCancel }: IssueFormProps) {
    const isEdit = !!issueId;

    const [meta, setMeta] = useState<IssueMetaOptions | null>(null);
    const [trackerId, setTrackerId] = useState('');
    const [statusId, setStatusId] = useState('');
    const [priorityId, setPriorityId] = useState('');
    const [assignedToPrincipal, setAssignedToPrincipal] = useState('');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(initialStartDate || '');
    const [dueDate, setDueDate] = useState(initialDueDate || '');
    const [estimatedHours, setEstimatedHours] = useState('');
    const [doneRatio, setDoneRatio] = useState('0');
    const [currentProjectId, setCurrentProjectId] = useState(projectId || '');
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
                if (!initialStartDate) {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const today = `${year}-${month}-${day}`;
                    setStartDate(`${today}T${data.startTime}`);
                } else {
                    setStartDate(initialStartDate.includes('T') ? initialStartDate : `${initialStartDate}T${data.startTime}`);
                }

                if (initialDueDate) {
                    setDueDate(initialDueDate);
                }
            }
        }).catch(() => { });
    }, [isEdit, initialStartDate, initialDueDate]);

    useEffect(() => {
        api.get('/issues/meta/options', { params: { projectId: currentProjectId } }).then((res) => {
            setMeta(res.data);
            if (!isEdit && res.data.trackers.length > 0) setTrackerId(String(res.data.trackers[0].id));
            if (!isEdit && res.data.statuses.length > 0) setStatusId(String(defaultStatusId ?? res.data.statuses[0].id));
            if (!isEdit && res.data.priorities.length > 0) {
                const normal = res.data.priorities.find((p: any) => p.name === '通常');
                setPriorityId(String(normal?.id || res.data.priorities[0].id));
            }
        }).catch((err) => {
            setError('メタデータの取得に失敗しました');
            setMeta({ trackers: [], statuses: [], priorities: [], users: [] });
        });
    }, [isEdit, currentProjectId]);

    useEffect(() => {
        if (isEdit) {
            api.get(`/issues/${issueId}`).then((res) => {
                const issue: Issue = res.data;
                setTrackerId(String(issue.trackerId));
                setStatusId(String(issue.statusId));
                setPriorityId(String(issue.priorityId));
                setAssignedToPrincipal(issue.assignedToGroupId ? `g:${issue.assignedToGroupId}` : issue.assignedToId ? `u:${issue.assignedToId}` : '');
                setSubject(issue.subject);
                setDescription(issue.description || '');
                setStartDate(issue.startDate ? toLocalDatetimeString(issue.startDate) : '');
                setDueDate(issue.dueDate ? issue.dueDate.slice(0, 10) : '');
                setEstimatedHours(issue.estimatedHours ? String(issue.estimatedHours) : '');
                setDoneRatio(String(issue.doneRatio));
                setCurrentProjectId(String(issue.projectId));
            }).catch((err) => {
                setError('チケットの取得に失敗しました');
            });
        }
    }, [issueId, isEdit]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const extractedUserId = assignedToPrincipal && assignedToPrincipal.startsWith('u:') ? Number(assignedToPrincipal.slice(2)) : null;
            const extractedGroupId = assignedToPrincipal && assignedToPrincipal.startsWith('g:') ? Number(assignedToPrincipal.slice(2)) : null;

            if (estimatedHours && !Number.isInteger(Number(estimatedHours))) {
                setError('予定工数は整数で入力してください');
                return;
            }

            const data: any = {
                trackerId: Number(trackerId),
                statusId: Number(statusId),
                priorityId: Number(priorityId),
                assignedToId: extractedUserId,
                assignedToGroupId: extractedGroupId,
                subject,
                description,
                startDate: startDate ? new Date(startDate).toISOString() : null,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                estimatedHours: estimatedHours ? Math.round(Number(estimatedHours)) : null,
                doneRatio: Number(doneRatio),
            };
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

    if (!meta) return <div className="text-center py-12 text-gray-500">読み込み中...</div>;

    return (
        <div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
                <TextInput
                    label="題名 *"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                />

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Combobox
                            label="トラッカー"
                            options={meta.trackers.map((t) => ({ value: String(t.id), label: t.name }))}
                            value={trackerId}
                            onChange={setTrackerId}
                        />
                        <Combobox
                            label="ステータス"
                            options={meta.statuses.map((s) => ({ value: String(s.id), label: s.name }))}
                            value={statusId}
                            onChange={setStatusId}
                        />
                        <Combobox
                            label="優先度"
                            options={meta.priorities.map((p) => ({ value: String(p.id), label: p.name }))}
                            value={priorityId}
                            onChange={setPriorityId}
                        />
                        <Combobox
                            label="担当者"
                            options={[
                                ...(meta.groups || []).map((g) => ({ value: `g:${g.id}`, label: `(グループ) ${g.name}` })),
                                ...(meta.users || []).map((u) => ({ value: `u:${u.id}`, label: `${u.lastName} ${u.firstName}` }))
                            ]}
                            value={assignedToPrincipal}
                            onChange={setAssignedToPrincipal}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                        <MarkdownEditor value={description} onChange={setDescription} rows={6} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <div className="flex gap-2 border rounded-md px-3 pt-5 pb-2">
                                <input type="date" value={startDate ? startDate.slice(0, 10) : ''} onChange={(e) => {
                                    const d = e.target.value;
                                    const t = startDate ? startDate.slice(11, 16) : systemStartTime;
                                    setStartDate(d ? `${d}T${t}` : '');
                                }} className="flex-1 bg-transparent focus:outline-none min-w-0" />
                                <div className="w-24">
                                    <AnalogTimePicker
                                        value={startDate ? startDate.slice(11, 16) : systemStartTime}
                                        onChange={(val) => {
                                            const d = startDate ? startDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
                                            setStartDate(`${d}T${val}`);
                                        }}
                                        disabled={!startDate}
                                    />
                                </div>
                            </div>
                            <label className="absolute left-3 top-1.5 text-xs text-gray-500 pointer-events-none">開始日時</label>
                        </div>
                        <NumberInput
                            label={`予定工数${totalDayConversion > 0 && estimatedHours ? ` (${formatEstimatedHours(Number(estimatedHours), totalDayConversion)})` : ''}`}
                            value={estimatedHours}
                            onChange={(e) => setEstimatedHours(e.target.value)}
                            step="1"
                            min="0"
                            endAdornment="時間"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <TextInput
                            label="期日"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                        <Combobox
                            label="進捗率 (%)"
                            options={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => ({ value: String(v), label: `${v}%` }))}
                            value={doneRatio}
                            onChange={setDoneRatio}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
                        {isEdit ? '更新' : '作成'}
                    </button>
                </div>
            </form >
        </div >
    );
}
