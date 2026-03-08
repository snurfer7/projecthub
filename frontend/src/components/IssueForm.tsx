import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { Issue, IssueMetaOptions } from '../types';
import MarkdownEditor from './MarkdownEditor';
import AnalogTimePicker from './AnalogTimePicker';

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
    initialDueDate?: string;
    onSuccess: (issueId: number) => void;
    onCancel: () => void;
}

export default function IssueForm({ projectId, issueId, initialDueDate, onSuccess, onCancel }: IssueFormProps) {
    const isEdit = !!issueId;

    const [meta, setMeta] = useState<IssueMetaOptions | null>(null);
    const [trackerId, setTrackerId] = useState('');
    const [statusId, setStatusId] = useState('');
    const [priorityId, setPriorityId] = useState('');
    const [assignedToPrincipal, setAssignedToPrincipal] = useState('');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState(initialDueDate || '');
    const [estimatedHours, setEstimatedHours] = useState('');
    const [doneRatio, setDoneRatio] = useState('0');
    const [currentProjectId, setCurrentProjectId] = useState(projectId || '');
    const [error, setError] = useState('');
    const [systemStartTime, setSystemStartTime] = useState('09:00');
    const [systemEndTime, setSystemEndTime] = useState('18:00');

    useEffect(() => {
        if (!isEdit) {
            api.get('/admin/settings/time').then((res) => {
                const { startTime, endTime } = res.data;
                setSystemStartTime(startTime);
                setSystemEndTime(endTime);
                if (initialDueDate) {
                    setDueDate(initialDueDate);
                }
            }).catch(() => { });
        }
    }, [isEdit, initialDueDate]);

    useEffect(() => {
        api.get('/issues/meta/options', { params: { projectId: currentProjectId } }).then((res) => {
            setMeta(res.data);
            if (!isEdit && res.data.trackers.length > 0) setTrackerId(String(res.data.trackers[0].id));
            if (!isEdit && res.data.statuses.length > 0) setStatusId(String(res.data.statuses[0].id));
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
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">題名 *</label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">トラッカー</label>
                        <select value={trackerId} onChange={(e) => setTrackerId(e.target.value)}
                            className="w-full border rounded-md px-3 py-2">
                            {meta.trackers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                        <select value={statusId} onChange={(e) => setStatusId(e.target.value)}
                            className="w-full border rounded-md px-3 py-2">
                            {meta.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">優先度</label>
                        <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}
                            className="w-full border rounded-md px-3 py-2">
                            {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                        <select value={assignedToPrincipal} onChange={(e) => setAssignedToPrincipal(e.target.value)}
                            className="w-full border rounded-md px-3 py-2">
                            <option value="">未割当</option>
                            {meta.groups && meta.groups.length > 0 && (
                                <optgroup label="グループ">
                                    {meta.groups.map((g) => <option key={`g:${g.id}`} value={`g:${g.id}`}>{g.name}</option>)}
                                </optgroup>
                            )}
                            {meta.users.length > 0 && (
                                <optgroup label="ユーザー">
                                    {meta.users.map((u) => <option key={`u:${u.id}`} value={`u:${u.id}`}>{u.lastName} {u.firstName}</option>)}
                                </optgroup>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                    <MarkdownEditor value={description} onChange={setDescription} rows={6} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">開始日時</label>
                        <div className="flex gap-2">
                            <input type="date" value={startDate ? startDate.slice(0, 10) : ''} onChange={(e) => {
                                const d = e.target.value;
                                const t = startDate ? startDate.slice(11, 16) : systemStartTime;
                                setStartDate(d ? `${d}T${t}` : '');
                            }} className="flex-1 border rounded-md px-3 py-2 min-w-0" />
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
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">予定工数 (時間)</label>
                        <input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} step="1" min="0"
                            className="w-full border rounded-md px-3 py-2" />
                    </div>
                </div >

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">期日</label>
                        <div className="flex gap-2">
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                                className="flex-1 border rounded-md px-3 py-2 min-w-0" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">進捗 (%)</label>
                        <select value={doneRatio} onChange={(e) => setDoneRatio(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => <option key={v} value={v}>{v}%</option>)}
                        </select>
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
