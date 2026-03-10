import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Issue, User, SystemSetting } from '../types';
import { Pencil, Users, Trash2, X, Check } from 'lucide-react';
import { formatEstimatedHours } from '../utils/format';
import MarkdownRenderer from './MarkdownRenderer';
import MarkdownEditor from './MarkdownEditor';
import ConfirmationModal from './ConfirmationModal';

interface IssueDetailProps {
    issueId: string;
    user: User;
    onEdit?: () => void;
    onRefresh?: () => void;
}

export default function IssueDetail({ issueId, user, onEdit, onRefresh }: IssueDetailProps) {
    const [issue, setIssue] = useState<Issue | null>(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [totalDayConversion, setTotalDayConversion] = useState(0);

    // Edit comment state
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editCommentContent, setEditCommentContent] = useState('');
    const [savingCommentId, setSavingCommentId] = useState<number | null>(null);

    // Add relation state
    const [showAddRelation, setShowAddRelation] = useState(false);
    const [availableIssues, setAvailableIssues] = useState<Issue[]>([]);
    const [isFetchingIssues, setIsFetchingIssues] = useState(false);
    const [relationIssueId, setRelationIssueId] = useState('');
    const [isAddingRelation, setIsAddingRelation] = useState(false);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const load = () => api.get(`/issues/${issueId}`).then((res) => {
        setIssue(res.data);
        onRefresh?.();
    });

    useEffect(() => {
        load();
        api.get('/admin/settings/time').then((res) => {
            const data: SystemSetting = res.data;
            const total = (data.conversionTimes || []).reduce((a, b) => a + b, 0);
            setTotalDayConversion(total);
        }).catch(() => { });
    }, [issueId]);

    const handleComment = async (e: FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;
        setSubmitting(true);
        try {
            await api.post(`/issues/${issueId}/comments`, { content: comment });
            setComment('');
            load();
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditComment = (commentId: number, currentContent: string) => {
        setEditingCommentId(commentId);
        setEditCommentContent(currentContent);
    };

    const handleSaveEditComment = async (commentId: number) => {
        if (!editCommentContent.trim()) return;
        setSavingCommentId(commentId);
        try {
            await api.put(`/issues/${issueId}/comments/${commentId}`, { content: editCommentContent });
            setEditingCommentId(null);
            setEditCommentContent('');
            load();
        } catch (e) {
            alert('コメントの更新に失敗しました');
        } finally {
            setSavingCommentId(null);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        setModalConfig({
            isOpen: true,
            title: 'コメントの削除',
            message: 'このコメントを削除しますか？この操作は取り消せません。',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await api.delete(`/issues/${issueId}/comments/${commentId}`);
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    load();
                } catch (e) {
                    alert('コメントの削除に失敗しました');
                }
            }
        });
    };

    const handleAddRelation = async (e: FormEvent) => {
        e.preventDefault();
        if (!relationIssueId) return;
        setIsAddingRelation(true);
        try {
            await api.post(`/issues/${issueId}/relations`, { issueToId: Number(relationIssueId), relationType: 'precedes' });
            setRelationIssueId('');
            setShowAddRelation(false);
            load();
        } catch (e: any) {
            alert('チケットの紐づけに失敗しました: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsAddingRelation(false);
        }
    };

    const handleDeleteRelation = async (relationId: number) => {
        setModalConfig({
            isOpen: true,
            title: '関連の削除',
            message: 'この関連チケットの紐付けを解除しますか？',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await api.delete(`/issues/relations/${relationId}`);
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    load();
                } catch (err: any) {
                    alert('関連の削除に失敗しました: ' + (err.response?.data?.error || err.message));
                }
            }
        });
    };

    const toggleAddRelation = async () => {
        if (!showAddRelation) {
            setIsFetchingIssues(true);
            try {
                const projId = issue?.projectId;
                const res = await api.get('/issues', { params: { projectId: projId } });
                const issuesArray = Array.isArray(res.data) ? res.data : [];
                const filtered = issuesArray.filter((i: Issue) => i.id !== Number(issueId));
                setAvailableIssues(filtered);
                if (filtered.length === 0) {
                    alert('紐づけ可能な他のチケットが見つかりませんでした。');
                } else {
                    setShowAddRelation(true);
                }
            } catch (e: any) {
                alert('チケット一覧の取得に失敗しました: ' + e.message);
            } finally {
                setIsFetchingIssues(false);
            }
        } else {
            setShowAddRelation(false);
            setRelationIssueId('');
        }
    };

    if (!issue) return <div className="text-center py-12 text-gray-500">読み込み中...</div>;

    return (
        <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium">{issue.tracker?.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${issue.status?.isClosed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                                }`}>{issue.status?.name}</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-800">{issue.subject}</h1>
                    </div>
                    {onEdit ? (
                        <button
                            onClick={onEdit}
                            title="編集"
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    ) : (
                        <Link to={`/issues/${issueId}/edit`} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                            <Pencil className="w-4 h-4" />
                        </Link>
                    )}
                </div>

                {issue.description && (
                    <div className="prose prose-sm max-w-none mb-4 text-gray-700 whitespace-pre-wrap">{issue.description}</div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
                    <div>
                        <span className="text-gray-500">優先度:</span>
                        <span className="ml-1 font-medium">{issue.priority?.name}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">担当者:</span>
                        <span className="ml-1">
                            {issue.assignedToGroup ? (
                                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-indigo-400" /> {issue.assignedToGroup.name}</span>
                            ) : issue.assignedTo ? (
                                `${issue.assignedTo.lastName} ${issue.assignedTo.firstName}`
                            ) : '未割当'}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">作成者:</span>
                        <span className="ml-1">{issue.author?.lastName} {issue.author?.firstName}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">進捗:</span>
                        <span className="ml-1">{issue.doneRatio}%</span>
                    </div>
                    {issue.startDate && <div><span className="text-gray-500">開始日時:</span><span className="ml-1">{new Date(issue.startDate).toLocaleString('ja-JP')}</span></div>}
                    {issue.estimatedHours && (
                        <div>
                            <span className="text-gray-500">予定工数:</span>
                            <span className="ml-1">
                                {issue.estimatedHours}h
                                {totalDayConversion > 0 && (
                                    <span className="ml-1 text-gray-500 font-normal">
                                        {formatEstimatedHours(issue.estimatedHours, totalDayConversion)}
                                    </span>
                                )}
                            </span>
                        </div>
                    )}
                    {issue.dueDate && <div><span className="text-gray-500">期日:</span><span className="ml-1">{new Date(issue.dueDate).toLocaleDateString('ja-JP')}</span></div>}
                </div>
            </div>

            {/* Attachments */}
            {issue.attachments && issue.attachments.length > 0 && (
                <div className="bg-white rounded-lg shadow p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">添付ファイル</h3>
                    {issue.attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 py-1">
                            <a href={`/api/attachments/download/${a.id}`} className="text-sky-600 hover:underline text-sm">{a.filename}</a>
                            <span className="text-xs text-gray-400">({(a.fileSize / 1024).toFixed(1)} KB)</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Time entries */}
            {issue.timeEntries && issue.timeEntries.length > 0 && (
                <div className="bg-white rounded-lg shadow p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">時間記録</h3>
                    <table className="w-full text-sm">
                        <thead><tr className="text-gray-500 text-left">
                            <th className="pb-2">日付</th><th className="pb-2">ユーザー</th><th className="pb-2">活動</th><th className="pb-2">時間</th><th className="pb-2">コメント</th>
                        </tr></thead>
                        <tbody>
                            {issue.timeEntries.map((te) => (
                                <tr key={te.id} className="border-t">
                                    <td className="py-2">{te.spentOn.split('T')[0]}</td>
                                    <td>{te.user.lastName} {te.user.firstName}</td>
                                    <td>{te.activity}</td>
                                    <td>{te.hours}h</td>
                                    <td className="text-gray-500">{te.comments || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Relations */}
            <div className="bg-white rounded-lg shadow p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700">関連するチケット</h3>
                    {!showAddRelation && (
                        <button
                            onClick={toggleAddRelation}
                            disabled={isFetchingIssues}
                            className="text-xs text-sky-600 hover:text-sky-700 font-medium disabled:text-gray-400"
                        >
                            {isFetchingIssues ? '読み込み中...' : '+ 関連チケットを追加'}
                        </button>
                    )}
                </div>

                {showAddRelation && (
                    <form onSubmit={handleAddRelation} className="mb-4 space-y-2 bg-slate-50 p-3 rounded border border-slate-100">
                        <div className="flex items-center gap-2">
                            <select
                                value={relationIssueId}
                                onChange={(e) => setRelationIssueId(e.target.value)}
                                className="flex-1 text-sm border rounded px-2 py-1.5 focus:ring-1 focus:ring-sky-500 outline-none bg-white"
                                autoFocus
                                required
                            >
                                <option value="">チケットを選択してください...</option>
                                {availableIssues.map((i) => (
                                    <option key={i.id} value={i.id}>
                                        #{i.id} {i.subject}
                                    </option>
                                ))}
                            </select>
                            {availableIssues.length === 0 && (
                                <p className="text-xs text-amber-600">他のチケットがありません</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={toggleAddRelation}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                disabled={isAddingRelation}
                                className="bg-sky-600 text-white px-3 py-1 rounded text-xs hover:bg-sky-700 disabled:opacity-50"
                            >
                                {isAddingRelation ? '追加中...' : '追加'}
                            </button>
                        </div>
                    </form>
                )}
                <div className="space-y-2">
                    {issue.relationsFrom?.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">先行</span>
                                <Link to={`/issues/${r.issueTo?.id}`} className="text-sky-600 hover:underline">
                                    #{r.issueTo?.id} {r.issueTo?.subject}
                                </Link>
                                <span className="text-xs text-gray-400">({(r.issueTo as any).status?.name})</span>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleDeleteRelation(r.id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                                title="リレーションを削除"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {issue.relationsTo?.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">後続</span>
                                <Link to={`/issues/${r.issueFrom?.id}`} className="text-sky-600 hover:underline">
                                    #{r.issueFrom?.id} {r.issueFrom?.subject}
                                </Link>
                                <span className="text-xs text-gray-400">({(r.issueFrom as any).status?.name})</span>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleDeleteRelation(r.id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                                title="リレーションを削除"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {(!issue.relationsFrom || issue.relationsFrom.length === 0) && (!issue.relationsTo || issue.relationsTo.length === 0) && (
                        <p className="text-xs text-gray-400 italic">関連するチケットはありません</p>
                    )}
                </div>
            </div>

            {/* Comments */}
            <div className="bg-white rounded-lg shadow p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">コメント</h3>
                <div className="space-y-4 mb-4">
                    {issue.comments?.map((c) => (
                        <div key={c.id} className="border-l-2 border-sky-200 pl-4 relative group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{c.user.lastName} {c.user.firstName}</span>
                                    <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString('ja-JP')}</span>
                                </div>
                                {user && user.id === c.user.id && editingCommentId !== c.id && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button onClick={() => handleEditComment(c.id, c.content)} className="p-1 text-gray-400 hover:text-sky-600 rounded hover:bg-sky-50" title="編集">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteComment(c.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="削除">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {editingCommentId === c.id ? (
                                <div className="mt-2">
                                    <MarkdownEditor
                                        value={editCommentContent}
                                        onChange={setEditCommentContent}
                                        rows={4}
                                        className="mb-2"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSaveEditComment(c.id)}
                                            disabled={savingCommentId === c.id || !editCommentContent.trim()}
                                            className="flex items-center gap-1 bg-sky-600 text-white px-3 py-1.5 rounded text-xs hover:bg-sky-700 disabled:opacity-50"
                                        >
                                            <Check className="w-3.5 h-3.5" /> 保存
                                        </button>
                                        <button
                                            onClick={() => setEditingCommentId(null)}
                                            disabled={savingCommentId === c.id}
                                            className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs hover:bg-gray-200 disabled:opacity-50"
                                        >
                                            <X className="w-3.5 h-3.5" /> キャンセル
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-700 prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                                    <MarkdownRenderer content={c.content} />
                                </div>
                            )}
                        </div>
                    ))}
                    {(!issue.comments || issue.comments.length === 0) && (
                        <p className="text-sm text-gray-400">コメントはありません</p>
                    )}
                </div>

                <form onSubmit={handleComment} className="border-t pt-4">
                    <MarkdownEditor
                        value={comment}
                        onChange={setComment}
                        rows={4}
                        placeholder="コメントを追加... (Markdown対応)"
                        className="mb-3"
                    />
                    <button type="submit" disabled={submitting || !comment.trim()}
                        className="bg-sky-600 text-white px-4 py-1.5 rounded text-sm hover:bg-sky-700 disabled:opacity-50">
                        コメント
                    </button>
                </form>
            </div>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                message={modalConfig.message}
                onConfirm={modalConfig.onConfirm}
                onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                variant={modalConfig.variant}
            />
        </div>
    );
}
