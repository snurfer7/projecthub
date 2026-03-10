import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trash2, Send, Paperclip, X } from 'lucide-react';
import api from '../api/client';
import { Project, ProjectComment } from '../types';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ConfirmationModal from '../components/ConfirmationModal';


interface ProjectContext {
    project: Project;
    loadProject: () => void;
}

export default function ProjectCommentsPage() {
    const { project, loadProject } = useOutletContext<ProjectContext>();
    const { user } = useAuth();
    const [comments, setComments] = useState<ProjectComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentFiles, setCommentFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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

    const loadComments = async () => {
        if (!project?.id) return;
        try {
            const res = await api.get(`/projects/${project.id}/comments`);
            setComments(res.data);
        } catch (err) {
            console.error('Failed to load comments:', err);
        }
    };

    useEffect(() => {
        loadComments();
    }, [project?.id]);

    const handleDownload = async (attachmentId: number) => {
        try {
            const res = await api.post(`/attachments/token/${attachmentId}`);
            const { token } = res.data;
            window.open(`/api/attachments/file/${attachmentId}?downloadToken=${token}`, '_blank');
        } catch (e) {
            alert('ファイルの取得に失敗しました');
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setLoading(true);
        try {
            const res = await api.post(`/projects/${project.id}/comments`, { content: newComment });

            if (commentFiles.length > 0) {
                await Promise.all(commentFiles.map(async (file) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('projectCommentId', String(res.data.id));
                    formData.append('projectId', String(project.id));
                    return api.post('/attachments/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }));
            }

            setNewComment('');
            setCommentFiles([]);
            await loadComments();
            loadProject(); // Update comment count in tabs
        } catch {
            alert('コメントの追加に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        try {
            await api.delete(`/projects/${project.id}/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
            setConfirmDeleteId(null);
            loadProject(); // Update comment count in tabs
        } catch {
            alert('コメントの削除に失敗しました');
        }
    };

    return (
        <div
            className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative ${isDragging ? 'bg-sky-50' : ''}`}
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
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">コメント ({comments.length})</h2>
            </div>
            <div className="p-6 space-y-6">
                {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8 italic">
                        コメントはまだありません。
                    </p>
                ) : (
                    <div className="space-y-6">
                        {comments.map(comment => (
                            <div key={comment.id} className="flex gap-4 group">
                                <div className="w-10 h-10 rounded-full bg-sky-100 flex-shrink-0 flex items-center justify-center text-sm font-bold text-sky-700">
                                    {comment.user.lastName[0]}{comment.user.firstName[0]}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <span className="font-semibold text-slate-800 text-sm">
                                                {comment.user.lastName} {comment.user.firstName}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-3">
                                                {new Date(comment.createdAt).toLocaleString('ja-JP')}
                                            </span>
                                        </div>
                                        {(user?.isAdmin || user?.id === comment.userId) && (
                                            <button
                                                onClick={() => setConfirmDeleteId(comment.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
                                                title="削除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100 mt-1 markdown-content">
                                        <MarkdownRenderer content={comment.content} />
                                    </div>
                                    {comment.attachments && comment.attachments.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {comment.attachments.map((a) => (
                                                <div key={a.id} className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleDownload(a.id)}
                                                        className="text-sky-600 hover:underline text-xs flex items-center gap-1"
                                                    >
                                                        <span className="bg-white px-1 rounded border border-gray-200 text-[10px]">FILE</span> {a.filename}
                                                    </button>
                                                    <span className="text-[10px] text-gray-400">({(a.fileSize / 1024).toFixed(1)} KB)</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="border-t pt-6">
                    <form onSubmit={handleAddComment}>
                        <div className="mb-4">
                            <MarkdownEditor
                                value={newComment}
                                onChange={setNewComment}
                                placeholder="プロジェクトにコメントを追加..."
                                rows={4}
                            />
                        </div>
                        <div className="space-y-3">
                            {commentFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {commentFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 text-xs">
                                            <span className="truncate max-w-[150px]">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setCommentFiles(prev => prev.filter((_, i) => i !== idx))}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded border border-slate-200 text-xs cursor-pointer transition-colors">
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
                                    disabled={!newComment.trim() || loading}
                                    className="bg-sky-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                >
                                    {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                                    コメントを送信
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                title="コメントの削除"
                message="このコメントを削除しますか？この操作は取り消せません。"
                onConfirm={() => confirmDeleteId && handleDeleteComment(confirmDeleteId)}
                onCancel={() => setConfirmDeleteId(null)}
                variant="danger"
            />
        </div>
    );
}
