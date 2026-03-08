import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trash2, Send } from 'lucide-react';
import api from '../api/client';
import { Project, ProjectComment } from '../types';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface ProjectContext {
    project: Project;
    loadProject: () => void;
}

export default function ProjectCommentsPage() {
    const { project, loadProject } = useOutletContext<ProjectContext>();
    const { user } = useAuth();
    const [comments, setComments] = useState<ProjectComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);

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

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setLoading(true);
        try {
            await api.post(`/projects/${project.id}/comments`, { content: newComment });
            setNewComment('');
            await loadComments();
            loadProject(); // Update comment count in tabs
        } catch {
            alert('コメントの追加に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!confirm('このコメントを削除しますか？')) return;
        try {
            await api.delete(`/projects/${project.id}/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
            loadProject(); // Update comment count in tabs
        } catch {
            alert('コメントの削除に失敗しました');
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-6">コメント ({comments.length})</h2>
            <div className="mb-8 space-y-6">
                {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-lg italic">
                        コメントはまだありません。
                    </p>
                ) : (
                    comments.map(comment => (
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
                                            onClick={() => handleDeleteComment(comment.id)}
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
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t pt-6">
                <form onSubmit={handleAddComment}>
                    <div className="mb-4">
                        <MarkdownEditor
                            value={newComment}
                            onChange={setNewComment}
                            placeholder="プロジェクトにコメントを追加..."
                            rows={10}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={!newComment.trim() || loading}
                            className="bg-sky-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                            コメントを送信
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
