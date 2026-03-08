import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';

interface WikiContentProps {
    title: string;
    content: string;
    authorName: string;
    updatedAt: string;
    onEdit: () => void;
    onDelete: () => void;
}

const WikiContent: React.FC<WikiContentProps> = ({
    title,
    content,
    authorName,
    updatedAt,
    onEdit,
    onDelete,
}) => {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <div className="text-xs text-gray-500 mt-1 flex gap-2">
                        <span>作成者: {authorName}</span>
                        <span>•</span>
                        <span>更新: {new Date(updatedAt).toLocaleString('ja-JP')}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onEdit}
                        className="p-2 text-sky-600 hover:bg-sky-100 rounded transition-colors"
                        title="編集"
                    >
                        <Pencil className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="削除"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="p-6 prose prose-slate max-w-none flex-1 overflow-y-auto">
                <MarkdownRenderer content={content || '*コンテンツがありません*'} />
            </div>
        </div>
    );
};

export default WikiContent;
