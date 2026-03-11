import { useState, useEffect, FormEvent } from 'react';
import api from '../api/client';
import { CompanyComment } from '../types';
import { Trash2, Send, X, Check, Paperclip, Pencil } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import MarkdownEditor from './MarkdownEditor';
import MarkdownRenderer from './MarkdownRenderer';
import ConfirmationModal from './ConfirmationModal';
import CommentModal from './CommentModal';


interface CompanyCommentsTabProps {
    companyId: number;
}

export default function CompanyCommentsTab({ companyId }: CompanyCommentsTabProps) {
    const [comments, setComments] = useState<CompanyComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingComment, setEditingComment] = useState<CompanyComment | null>(null);
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

    const handleOpenCreateModal = () => {
        setModalMode('create');
        setEditingComment(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (comment: CompanyComment) => {
        setModalMode('edit');
        setEditingComment(comment);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (content: string, files: File[]) => {
        try {
            if (modalMode === 'create' || modalMode === 'edit') {
                let commentId: number;
                if (modalMode === 'create') {
                    const res = await api.post(`/companies/${companyId}/comments`, { content });
                    commentId = res.data.id;
                } else {
                    await api.put(`/companies/${companyId}/comments/${editingComment!.id}`, { content });
                    commentId = editingComment!.id;
                }

                if (files.length > 0) {
                    await Promise.all(files.map(async (file) => {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('companyCommentId', String(commentId));
                        formData.append('companyId', String(companyId));
                        return api.post('/attachments/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    }));
                }
            }

            await loadComments();
            setIsModalOpen(false); // Close modal on successful submit
        } catch (err: any) {
            alert(err.response?.data?.error || `コメントの${modalMode === 'create' ? '投稿' : '更新'}に失敗しました`);
            throw err;
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



    if (loading) return <div className="text-center py-8 text-gray-500">読み込み中...</div>;
    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">{error}</div>;

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow min-h-[500px] relative">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-slate-700">コメント ({comments.length})</h3>
                <button
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-1.5 bg-sky-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-sky-700 transition-colors shadow-sm"
                >
                    <Send className="w-3.5 h-3.5" />
                    コメントを投稿
                </button>
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
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-slate-700">
                                                {comment.user.lastName} {comment.user.firstName}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(comment.createdAt).toLocaleString('ja-JP')}
                                            </span>
                                        </div>
                                        {(user?.isAdmin || user?.id === comment.userId) && (
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/80 rounded">
                                                <button
                                                    onClick={() => handleOpenEditModal(comment)}
                                                    className="p-1 text-gray-400 hover:text-sky-600 transition-colors"
                                                    title="編集"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(comment.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="コメントを削除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="text-xs text-gray-600 markdown-content">
                                        <MarkdownRenderer content={comment.content} />
                                    </div>
                                    {comment.attachments && comment.attachments.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {comment.attachments.map((a) => (
                                                <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 bg-white shadow-sm">
                                                    <button
                                                        onClick={() => handleDownload(a.id)}
                                                        className="text-sky-600 hover:text-sky-700 font-medium text-[10px] truncate max-w-[150px]"
                                                        title={a.filename}
                                                    >
                                                        {a.filename}
                                                    </button>
                                                    <span className="text-[9px] text-gray-400 border-l border-gray-100 pl-1.5 flex-shrink-0">
                                                        {(a.fileSize / 1024).toFixed(1)} KB
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            </div>
                        ))
                )}
            </div>

            <CommentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalMode === 'create' ? 'コメントの追加' : 'コメントの編集'}
                initialContent={editingComment?.content || ''}
                onSubmit={handleModalSubmit}
                submitLabel={modalMode === 'create' ? '投稿する' : '保存'}
                showAttachments={true}
            />

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
