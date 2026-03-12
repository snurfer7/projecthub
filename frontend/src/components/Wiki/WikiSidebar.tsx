import React, { useMemo, useState } from 'react';
import { Plus, ChevronDown, FileText, GripVertical } from 'lucide-react';

interface WikiPageListItem {
    id: number;
    title: string;
    parentId?: number | null;
    position?: number;
}

interface WikiSidebarProps {
    pages: WikiPageListItem[];
    selectedPageId: number | null;
    onSelectPage: (id: number) => void;
    onMovePage: (id: number, targetParentId: number | null, position: number) => void;
    onCreateNew: () => void;
    isEditing: boolean;
    loading?: boolean;
}

interface TreeItemProps {
    page: WikiPageListItem & { children: any[] };
    selectedPageId: number | null;
    onSelectPage: (id: number) => void;
    onDragStart: (e: React.DragEvent, id: number) => void;
    onDragOver: (e: React.DragEvent, id: number) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, id: number) => void;
    dragOverId: number | null;
    dragPos: 'before' | 'after' | 'inside' | null;
    isEditing: boolean;
    level: number;
}

const TreeItem: React.FC<TreeItemProps> = ({
    page, selectedPageId, onSelectPage, isEditing, level,
    onDragStart, onDragOver, onDragLeave, onDrop,
    dragOverId, dragPos
}) => {
    const hasChildren = page.children && page.children.length > 0;
    const isSelected = !isEditing && selectedPageId === page.id;
    const isBeingDraggedOver = dragOverId === page.id;

    return (
        <li
            className="relative"
            onDragOver={(e) => onDragOver(e, page.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, page.id)}
        >
            {isBeingDraggedOver && dragPos === 'before' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-sky-500 z-10" />
            )}

            <div
                draggable={!isEditing}
                onDragStart={(e) => onDragStart(e, page.id)}
                className={`group flex items-center gap-1 w-full transition-colors cursor-pointer ${isSelected
                    ? 'bg-sky-50 text-sky-700 font-medium border-l-2 border-sky-500'
                    : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
                    } ${isBeingDraggedOver && dragPos === 'inside' ? 'bg-sky-100' : ''}`}
                style={{ paddingLeft: `${8 + level * 16}px` }}
                onClick={() => onSelectPage(page.id)}
            >
                <div className="p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3 h-3 text-gray-400" />
                </div>
                <div className="flex items-center gap-2 py-2 pr-4 flex-1 truncate">
                    {hasChildren ? (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    ) : (
                        <FileText className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    )}
                    <span className="truncate">{page.title}</span>
                </div>
            </div>

            {isBeingDraggedOver && dragPos === 'after' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 z-10" />
            )}

            {hasChildren && (
                <ul className="">
                    {page.children.map((child) => (
                        <TreeItem
                            key={child.id}
                            page={child}
                            selectedPageId={selectedPageId}
                            onSelectPage={onSelectPage}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            dragOverId={dragOverId}
                            dragPos={dragPos}
                            isEditing={isEditing}
                            level={level + 1}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
};

const WikiSidebar: React.FC<WikiSidebarProps> = ({
    pages,
    selectedPageId,
    onSelectPage,
    onMovePage,
    onCreateNew,
    isEditing,
    loading = false,
}) => {
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [dragPos, setDragPos] = useState<'before' | 'after' | 'inside' | null>(null);

    const itemsMap = useMemo(() => {
        const map = new Map<number, WikiPageListItem>();
        pages.forEach(p => map.set(p.id, p));
        return map;
    }, [pages]);

    const isDescendantOf = (targetId: number | null, draggedId: number): boolean => {
        if (!targetId) return false;
        let current = itemsMap.get(targetId);
        while (current && current.parentId) {
            if (current.parentId === draggedId) return true;
            current = itemsMap.get(current.parentId);
        }
        return false;
    };

    const treeData = useMemo(() => {
        const map = new Map<number, any>();
        const roots: any[] = [];

        pages.forEach(p => map.set(p.id, { ...p, children: [] }));
        pages.forEach(p => {
            if (p.parentId && map.has(p.parentId)) {
                map.get(p.parentId).children.push(map.get(p.id));
            } else {
                roots.push(map.get(p.id));
            }
        });

        // Sort children by position
        const sortNodes = (nodes: any[]) => {
            nodes.sort((a, b) => (a.position || 0) - (b.position || 0));
            nodes.forEach(n => sortNodes(n.children));
        };
        sortNodes(roots);

        return roots;
    }, [pages]);

    const handleDragStart = (e: React.DragEvent, id: number) => {
        setDraggedId(id);
        e.dataTransfer.setData('text/plain', id.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, id: number) => {
        e.preventDefault();
        if (draggedId === null || draggedId === id) return;

        const targetPage = itemsMap.get(id);
        if (!targetPage) return;

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const y = e.clientY - rect.top;

        let pos: 'before' | 'after' | 'inside' | null = null;
        if (y < rect.height * 0.25) {
            pos = 'before';
        } else if (y > rect.height * 0.75) {
            pos = 'after';
        } else {
            pos = 'inside';
        }

        // Cycle prevention check
        const potentialNewParentId = pos === 'inside' ? id : (targetPage.parentId || null);
        if (potentialNewParentId === draggedId || isDescendantOf(potentialNewParentId, draggedId)) {
            e.dataTransfer.dropEffect = 'none';
            setDragOverId(null);
            setDragPos(null);
            return;
        }

        e.dataTransfer.dropEffect = 'move';
        setDragPos(pos);
        setDragOverId(id);
    };

    const handleDragLeave = () => {
        setDragOverId(null);
        setDragPos(null);
    };

    const handleDrop = (e: React.DragEvent, targetId: number) => {
        e.preventDefault();
        if (draggedId === null || draggedId === targetId) {
            handleDragLeave();
            return;
        }

        const targetPage = pages.find(p => p.id === targetId);
        if (!targetPage) return;

        let newParentId: number | null = null;
        let newPosition = 0;

        if (dragPos === 'inside') {
            newParentId = targetId;
            newPosition = 9999; // Put at the end
        } else {
            newParentId = targetPage.parentId || null;
            // Get siblings to determine new position
            const siblings = pages.filter(p => p.parentId === newParentId).sort((a, b) => (a.position || 0) - (b.position || 0));
            const targetIndex = siblings.findIndex(p => p.id === targetId);

            if (dragPos === 'before') {
                newPosition = targetIndex === 0 ? (siblings[0].position || 0) - 10 : (siblings[targetIndex - 1].position || 0) + ((siblings[targetIndex].position || 0) - (siblings[targetIndex - 1].position || 0)) / 2;
            } else {
                newPosition = targetIndex === siblings.length - 1 ? (siblings[siblings.length - 1].position || 0) + 10 : (siblings[targetIndex].position || 0) + ((siblings[targetIndex + 1].position || 0) - (siblings[targetIndex].position || 0)) / 2;
            }
        }

        onMovePage(draggedId, newParentId, newPosition);
        handleDragLeave();
        setDraggedId(null);
    };

    return (
        <div className="w-full md:w-64 shrink-0 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">Wikiページ</h3>
                <button
                    onClick={onCreateNew}
                    className="p-1.5 text-sky-600 hover:bg-sky-50 rounded transition-colors"
                    title="新規ページ作成"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden flex-1 border border-gray-100 py-2">
                {loading ? (
                    <div className="p-4 text-sm text-gray-500 text-center">読み込み中...</div>
                ) : pages.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">ページがありません</div>
                ) : (
                    <ul className="flex flex-col">
                        {treeData.map((page) => (
                            <TreeItem
                                key={page.id}
                                page={page}
                                selectedPageId={selectedPageId}
                                onSelectPage={onSelectPage}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                dragOverId={dragOverId}
                                dragPos={dragPos}
                                isEditing={isEditing}
                                level={0}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default WikiSidebar;
