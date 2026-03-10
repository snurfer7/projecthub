import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { CompanyComment } from '../types';
import { Trash2, Send, X, Check, Paperclip } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from './MarkdownEditor';
import MarkdownRenderer from './MarkdownRenderer';
import ConfirmationModal from './ConfirmationModal';


interface CompanyCommentsTabProps {
    companyId: number;
}

export default function CompanyCommentsTab({ companyId }: CompanyCommentsTabProps) {
    const [comments, setComments] = useState<CompanyComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newComment, setNewComment] = useState('');
    const [commentFiles, setCommentFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const { user } = useAuth(); // Assuming AuthContext provides current user


    const loadComments = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/companies/${companyId}/comments`);
            setComments(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'コメントの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadComments();
    }, [companyId]);

    const handleDownload = async (attachmentId: number) => {
        try {
            const res = await api.post(`/attachments/token/${attachmentId}`);
            const { token } = res.data;
            window.open(`/api/attachments/file/${attachmentId}?downloadToken=${token}`, '_blank');
        } catch (e) {
            alert('ファイルの取得に失敗しました');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setSubmitting(true);

        try {
            const res = await api.post(`/companies/${companyId}/comments`, { content: newComment });

            if (commentFiles.length > 0) {
                await Promise.all(commentFiles.map(async (file) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('companyCommentId', String(res.data.id));
                    formData.append('companyId', String(companyId));
                    return api.post('/attachments/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }));
            }

            setNewComment('');
            setCommentFiles([]);
            await loadComments();
        } catch (err: any) {
            alert(err.response?.data?.error || 'コメントの投稿に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (commentId: number) => {
        try {
            await api.delete(`/companies/${companyId}/comments/${commentId}`);
            setConfirmDeleteId(null);
            await loadComments();
        } catch (err: any) {
            alert(err.response?.data?.error || 'コメントの削除に失敗しました');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setCommentFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    if (loading) return <div className="text-center py-8 text-gray-500">読み込み中...</div>;
    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">{error}</div>;

    return (
        <div
            className={`flex flex-col h-full bg-white rounded-lg shadow min-h-[500px] relative ${isDragging ? 'bg-sky-50' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-sky-500/10 pointer-events-none rounded-lg">
                    <div className="bg-white px-6 py-4 rounded-xl shadow-xl border-2 border-dashed border-sky-400 animate-in fade-in zoom-in duration-150">
                        <p className="text-sky-600 font-medium flex items-center gap-2">
                            <Paperclip className="w-5 h-5" />
                            ファイルをドロップして添付
                        </p>
                    </div>
                </div>
            )}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-slate-700">コメント ({comments.length})</h3>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {comments.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p className="mb-2">まだコメントがありません</p>
                        <p className="text-sm">最初のコメントを投稿して、情報を共有しましょう</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-sm">
                                    {comment.user.lastName?.[0]}{comment.user.firstName?.[0]}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 relative group">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium text-sm text-slate-700">
                                            {comment.user.lastName} {comment.user.firstName}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(comment.createdAt).toLocaleString('ja-JP')}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 markdown-content">
                                        <MarkdownRenderer content={comment.content} />
                                    </div>

                                    {comment.attachments && comment.attachments.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {comment.attachments.map((a) => (
                                                <div key={a.id} className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleDownload(a.id)}
                                                        className="text-sky-600 hover:underline text-xs flex items-center gap-1 text-left"
                                                    >
                                                        <span className="bg-white px-1 rounded border border-gray-200 text-[10px]">FILE</span> {a.filename}
                                                    </button>
                                                    <span className="text-[10px] text-gray-400">({(a.fileSize / 1024).toFixed(1)} KB)</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Delete button - show on hover if user is author or admin */}
                                    {(user?.isAdmin || user?.id === comment.userId) && (
                                        <button
                                            onClick={() => setConfirmDeleteId(comment.id)}
                                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded"
                                            title="コメントを削除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Comment Input */}
            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="mb-3">
                        <MarkdownEditor
                            value={newComment}
                            onChange={setNewComment}
                            placeholder="コメントを入力..."
                            rows={5}
                        />
                    </div>
                    <div className="space-y-3">
                        {commentFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {commentFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200 text-xs">
                                        <span className="truncate max-w-[150px]">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setCommentFiles(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded border border-gray-200 text-xs cursor-pointer transition-colors">
                                    <Paperclip className="w-3.5 h-3.5" />
                                    ファイルを添付
                                    <input
                                        type="file"
                                        className="sr-only"
                                        multiple
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length > 0) {
                                                setCommentFiles(prev => [...prev, ...files]);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                            </div>
                            <button
                                type="submit"
                                disabled={!newComment.trim() || submitting}
                                className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm disabled:bg-gray-400 flex items-center gap-2 transition-colors"
                            >
                                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                                投稿する
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                title="コメントの削除"
                message="このコメントを削除しますか？この操作は取り消せません。"
                onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                onCancel={() => setConfirmDeleteId(null)}
                variant="danger"
            />
        </div>
    );
}
