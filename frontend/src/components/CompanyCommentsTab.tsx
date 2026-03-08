import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { CompanyComment } from '../types';
import { Trash2, Send } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from './MarkdownEditor';
import MarkdownRenderer from './MarkdownRenderer';

interface CompanyCommentsTabProps {
    companyId: number;
}

export default function CompanyCommentsTab({ companyId }: CompanyCommentsTabProps) {
    const [comments, setComments] = useState<CompanyComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newComment, setNewComment] = useState('');
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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            await api.post(`/companies/${companyId}/comments`, { content: newComment });
            setNewComment('');
            await loadComments();
        } catch (err: any) {
            alert(err.response?.data?.error || 'コメントの投稿に失敗しました');
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!confirm('このコメントを削除しますか？')) return;

        try {
            await api.delete(`/companies/${companyId}/comments/${commentId}`);
            await loadComments();
        } catch (err: any) {
            alert(err.response?.data?.error || 'コメントの削除に失敗しました');
        }
    };

    if (loading) return <div className="text-center py-8 text-gray-500">読み込み中...</div>;
    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow min-h-[500px]">
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

                                    {/* Delete button - show on hover if user is author or admin */}
                                    {(user?.isAdmin || user?.id === comment.userId) && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
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
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={!newComment.trim()}
                            className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm disabled:bg-gray-400 flex items-center gap-2 transition-colors"
                        >
                            <Send className="w-4 h-4" /> 投稿する
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
