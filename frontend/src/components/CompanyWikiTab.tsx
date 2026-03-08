import { useState, useEffect } from 'react';
import api from '../api/client';
import { CompanyWikiPage } from '../types';
import { Plus } from 'lucide-react';
import WikiSidebar from './Wiki/WikiSidebar';
import WikiContent from './Wiki/WikiContent';
import WikiEditor from './Wiki/WikiEditor';

interface CompanyWikiTabProps {
    companyId: number;
}

export default function CompanyWikiTab({ companyId }: CompanyWikiTabProps) {
    const [pages, setPages] = useState<CompanyWikiPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedPage, setSelectedPage] = useState<CompanyWikiPage | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editParentId, setEditParentId] = useState<number | null>(null);

    const loadPages = async (selectTitle?: string) => {
        try {
            setLoading(true);
            const res = await api.get(`/companies/${companyId}/wiki`);
            setPages(res.data);

            if (selectTitle) {
                const newPage = res.data.find((p: CompanyWikiPage) => p.title === selectTitle);
                if (newPage) setSelectedPage(newPage);
            } else if (res.data.length > 0 && !selectedPage && !isEditing) {
                setSelectedPage(res.data[0]);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Wikiページの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPages();
    }, [companyId]);

    const handleCreateNew = () => {
        const currentId = selectedPage?.id || null;
        setSelectedPage(null);
        setEditTitle('');
        setEditContent('');
        setEditParentId(currentId);
        setIsEditing(true);
    };

    const handleEdit = () => {
        if (!selectedPage) return;
        setEditTitle(selectedPage.title);
        setEditContent(selectedPage.content);
        setEditParentId(selectedPage.parentId || null);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        if (!selectedPage && pages.length > 0) {
            setSelectedPage(pages[0]);
        }
    };

    const handleSave = async () => {
        if (!editTitle.trim()) {
            alert('タイトルを入力してください');
            return;
        }

        try {
            await api.put(`/companies/${companyId}/wiki/${encodeURIComponent(editTitle)}`, {
                content: editContent,
                parentId: editParentId
            });

            await loadPages(editTitle);
            setIsEditing(false);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Wikiページの保存に失敗しました');
        }
    };

    const handleDelete = async () => {
        if (!selectedPage) return;
        if (!confirm(`「${selectedPage.title}」を削除しますか？`)) return;

        try {
            await api.delete(`/companies/${companyId}/wiki/${encodeURIComponent(selectedPage.title)}`);
            setSelectedPage(null);
            await loadPages();
        } catch (err: any) {
            alert(err.response?.data?.error || 'Wikiページの削除に失敗しました');
        }
    };

    const handleMovePage = async (id: number, parentId: number | null, position: number) => {
        const page = pages.find(p => p.id === id);
        if (!page) return;
        try {
            await api.patch(`/companies/${companyId}/wiki/${encodeURIComponent(page.title)}/move`, { parentId, position });
            await loadPages(page.title);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Wikiページの移動に失敗しました');
        }
    };

    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">{error}</div>;

    return (
        <div className="flex flex-col md:flex-row gap-6 min-h-[500px]">
            <WikiSidebar
                pages={pages}
                selectedPageId={selectedPage?.id || null}
                onSelectPage={(id) => {
                    if (selectedPage?.id === id) {
                        setSelectedPage(null);
                    } else {
                        const page = pages.find(p => p.id === id);
                        if (page) {
                            setSelectedPage(page);
                            setIsEditing(false);
                        }
                    }
                }}
                onMovePage={handleMovePage}
                onCreateNew={handleCreateNew}
                isEditing={isEditing}
                loading={loading && pages.length === 0}
            />

            <div className="flex-1 bg-white rounded-lg shadow border border-gray-100 flex flex-col overflow-hidden">
                {isEditing ? (
                    <WikiEditor
                        title={editTitle}
                        onTitleChange={setEditTitle}
                        content={editContent}
                        onContentChange={setEditContent}
                        onSave={handleSave}
                        onCancel={handleCancelEdit}
                        isNewPage={!selectedPage}
                        allPages={pages}
                        parentId={editParentId}
                        onParentIdChange={setEditParentId}
                        currentPageId={selectedPage?.id}
                    />
                ) : selectedPage ? (
                    <WikiContent
                        title={selectedPage.title}
                        content={selectedPage.content}
                        authorName={`${selectedPage.author.lastName} ${selectedPage.author.firstName}`}
                        updatedAt={selectedPage.updatedAt}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 min-h-[400px]">
                        <div className="bg-gray-50 p-6 rounded-full mb-4">
                            <Plus className="w-12 h-12 text-gray-300" />
                        </div>
                        <p className="text-lg font-medium text-gray-500 mb-2">Wikiページが選択されていません</p>
                        <p className="text-sm">左側のリストから選択するか、新しく作成してください</p>
                        <button
                            onClick={handleCreateNew}
                            className="mt-6 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors shadow-sm"
                        >
                            ページを作成する
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
