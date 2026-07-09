import { useState, useRef, useEffect, useCallback } from 'react';
import { Bookmark, Star, Trash2, ChevronDown, Check, Plus, Save } from 'lucide-react';
import api from '../api/client';
import type { SavedSearch, ProjectListViewMode } from '../types';

interface SavedSearchDropdownProps {
  viewMode: ProjectListViewMode;
  /** 現在アクティブな保存済み検索の ID（未選択時は null） */
  activeId: number | null;
  /** 保存時に渡すフィルター状態 */
  currentFilter: SavedSearch['filter'];
  /** 保存済み検索を選択したときのコールバック */
  onLoad: (search: SavedSearch) => void;
  /** 一覧が変化したときのコールバック（外部でのリロード用途） */
  onListChange?: () => void;
}

export default function SavedSearchDropdown({
  viewMode,
  activeId,
  currentFilter,
  onLoad,
  onListChange,
}: SavedSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  /** API が 403 を返した場合は input 不可とみなす */
  const [canInputSaved, setCanInputSaved] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [fetchError, setFetchError] = useState('');

  const fetchSearches = useCallback(async () => {
    setFetchError('');
    try {
      const res = await api.get('/saved-searches', { params: { viewMode } });
      setSearches(res.data);
    } catch (err: any) {
      setSearches([]);
      if (err?.response?.status !== 403) {
        setFetchError(err?.response?.data?.error || `取得エラー (${err?.response?.status ?? 'network'})`);
      }
    }
  }, [viewMode]);

  // viewMode が変わったら再取得
  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        resetForm();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeSearch = searches.find((s) => s.id === activeId);
  const buttonLabel = activeSearch ? activeSearch.name : '保存済み';

  function resetForm() {
    setShowSaveForm(false);
    setSaveName('');
    setSaveError('');
  }

  const handleToggleDefault = async (e: React.MouseEvent, search: SavedSearch) => {
    e.stopPropagation();
    try {
      await api.put(`/saved-searches/${search.id}`, { isDefault: !search.isDefault });
      await fetchSearches();
      onListChange?.();
    } catch (err: any) {
      if (err?.response?.status === 403) setCanInputSaved(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, search: SavedSearch) => {
    e.stopPropagation();
    if (!window.confirm(`「${search.name}」を削除しますか？`)) return;
    try {
      await api.delete(`/saved-searches/${search.id}`);
      await fetchSearches();
      onListChange?.();
    } catch (err: any) {
      if (err?.response?.status === 403) setCanInputSaved(false);
    }
  };

  /** 指定した保存済み検索を現在の条件で上書き */
  const handleOverwrite = async (e: React.MouseEvent, search: SavedSearch) => {
    e.stopPropagation();
    if (!window.confirm(`「${search.name}」を現在の条件で上書きしますか？`)) return;
    try {
      await api.put(`/saved-searches/${search.id}`, { filter: currentFilter });
      await fetchSearches();
      onListChange?.();
      // 上書きした検索をアクティブに
      onLoad({ ...search, filter: currentFilter });
      setIsOpen(false);
      resetForm();
    } catch (err: any) {
      if (err?.response?.status === 403) setCanInputSaved(false);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      setSaveError('名称を入力してください');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await api.post('/saved-searches', {
        viewMode,
        name: saveName.trim(),
        filter: currentFilter,
        isDefault: false,
      });
      resetForm();
      await fetchSearches();
      onListChange?.();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setCanInputSaved(false);
        setSaveError('保存の権限がありません');
      } else {
        setSaveError(err.response?.data?.error || '保存に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) resetForm();
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
          activeId != null
            ? 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100'
            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
        title="保存済み検索条件"
      >
        <Bookmark size={13} />
        <span className="max-w-[8rem] truncate">{buttonLabel}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[220px] max-w-[320px]">
          {/* エラー表示 */}
          {fetchError && (
            <div className="px-3 py-2 text-xs text-red-500">{fetchError}</div>
          )}

          {/* 保存済み一覧 */}
          {!fetchError && searches.length === 0 && !showSaveForm && (
            <div className="px-3 py-3 text-xs text-gray-400">保存済みの検索条件はありません</div>
          )}
          {searches.length > 0 && (
            <ul className="py-1 max-h-60 overflow-y-auto">
              {searches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onLoad(s);
                      setIsOpen(false);
                      resetForm();
                    }}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-left hover:bg-gray-50"
                  >
                    {s.isDefault && (
                      <Star size={11} className="text-amber-400 shrink-0" fill="currentColor" />
                    )}
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.id === activeId && (
                      <Check size={12} className="text-sky-600 shrink-0" />
                    )}
                    {canInputSaved && (
                      <span className="flex items-center gap-0.5 ml-1">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleOverwrite(e, s)}
                          onKeyDown={(e) => e.key === 'Enter' && handleOverwrite(e as any, s)}
                          title="現在の条件で上書き"
                          className="p-0.5 rounded text-gray-300 hover:text-sky-500 transition-colors"
                        >
                          <Save size={12} />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleToggleDefault(e, s)}
                          onKeyDown={(e) => e.key === 'Enter' && handleToggleDefault(e as any, s)}
                          title={s.isDefault ? 'デフォルト解除' : 'デフォルトに設定'}
                          className={`p-0.5 rounded transition-colors ${
                            s.isDefault
                              ? 'text-amber-400 hover:text-gray-400'
                              : 'text-gray-300 hover:text-amber-400'
                          }`}
                        >
                          <Star size={12} fill={s.isDefault ? 'currentColor' : 'none'} />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleDelete(e, s)}
                          onKeyDown={(e) => e.key === 'Enter' && handleDelete(e as any, s)}
                          title="削除"
                          className="p-0.5 rounded text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 保存フォーム or 保存ボタン */}
          {canInputSaved && (
            <div className={searches.length > 0 ? 'border-t border-gray-100' : ''}>
              {showSaveForm ? (
                <div className="p-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="条件の名称"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') resetForm();
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs mb-1 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                  {saveError && <p className="text-red-500 text-xs mb-1">{saveError}</p>}
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-2 py-1 text-xs rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* アクティブな検索がある場合は上書き保存ボタンを優先表示 */}
                  {activeSearch && (
                    <button
                      type="button"
                      onClick={(e) => handleOverwrite(e, activeSearch)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-sky-600 hover:bg-sky-50 font-medium"
                    >
                      <Save size={13} />
                      「{activeSearch.name}」を上書き保存
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSaveForm(true)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 font-medium ${activeSearch ? 'text-gray-500' : 'text-sky-600 hover:bg-sky-50'}`}
                  >
                    <Plus size={13} />
                    新しい名前で保存
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
