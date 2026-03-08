import React from 'react';
import { Save, X } from 'lucide-react';
import MarkdownEditor from '../MarkdownEditor';

interface WikiEditorProps {
    title: string;
    onTitleChange: (title: string) => void;
    content: string;
    onContentChange: (content: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isNewPage: boolean;
    allPages: { id: number; title: string; parentId?: number | null }[];
    parentId: number | null;
    onParentIdChange: (parentId: number | null) => void;
    currentPageId?: number | null;
}

const WikiEditor: React.FC<WikiEditorProps> = ({
    title,
    onTitleChange,
    content,
    onContentChange,
    onSave,
    onCancel,
    isNewPage,
    allPages,
    parentId,
    onParentIdChange,
    currentPageId,
}) => {
    // 循環参照を防ぐために、自分自身とその子孫を親として選択できないようにする
    const getDescendantIds = (id: number): number[] => {
        const descendants: number[] = [];
        const children = allPages.filter(p => p.parentId === id);
        children.forEach(c => {
            descendants.push(c.id);
            descendants.push(...getDescendantIds(c.id));
        });
        return descendants;
    };

    const invalidParentIds = currentPageId ? [currentPageId, ...getDescendantIds(currentPageId)] : [];
    const availableParents = allPages.filter(p => !invalidParentIds.includes(p.id));

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-gray-50 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        placeholder="ページタイトル"
                        disabled={!isNewPage}
                        className="flex-1 font-semibold text-lg bg-white border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-gray-100"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 transition-colors"
                        >
                            <X className="w-4 h-4" /> キャンセル
                        </button>
                        <button
                            onClick={onSave}
                            className="px-3 py-1.5 text-sm text-white bg-sky-600 rounded hover:bg-sky-700 flex items-center gap-1 transition-colors"
                        >
                            <Save className="w-4 h-4" /> 保存
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-600 w-24">親ページ:</label>
                    <select
                        value={parentId || ''}
                        onChange={(e) => onParentIdChange(e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        <option value="">(なし - トップレベル)</option>
                        {availableParents.map(p => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="p-0 flex-1 min-h-[400px]">
                <MarkdownEditor
                    value={content}
                    onChange={onContentChange}
                    rows={20}
                    className="h-full border-none rounded-none"
                />
            </div>
        </div>
    );
};

export default WikiEditor;
