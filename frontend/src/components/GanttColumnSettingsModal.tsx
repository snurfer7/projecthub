import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Modal from './Modal';
import {
  defaultGanttColumns,
  ganttColumnDef,
  ganttColumnLabel,
  type GanttColumnConfig,
  type GanttColumnKey,
} from '../utils/ganttColumns';

interface GanttColumnSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: GanttColumnConfig[];
  onApply: (columns: GanttColumnConfig[]) => void;
}

export default function GanttColumnSettingsModal({
  isOpen,
  onClose,
  value,
  onApply,
}: GanttColumnSettingsModalProps) {
  const [draft, setDraft] = useState<GanttColumnConfig[]>(() => [...value]);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(value.map((c) => ({ ...c })));
  }, [isOpen, value]);

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= draft.length) return;
    setDraft((prev) => {
      const copy = [...prev];
      const tmp = copy[index];
      copy[index] = copy[next];
      copy[next] = tmp;
      return copy;
    });
  };

  const toggleVisible = (key: GanttColumnKey) => {
    const def = ganttColumnDef(key);
    if (!def.hideable) return;
    setDraft((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  };

  const handleReset = () => {
    setDraft(defaultGanttColumns());
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ガント列の設定" size="md">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          表示する列と並び順を設定します。列幅はガント上でドラッグして変更できます。設定はアカウントに保存されます。
        </p>
        <ul className="border rounded-lg divide-y max-h-80 overflow-y-auto">
          {draft.map((col, index) => {
            const def = ganttColumnDef(col.key);
            return (
              <li key={col.key} className="flex items-center gap-2 px-3 py-2 text-sm bg-white">
                <label
                  className={`flex flex-1 min-w-0 items-center gap-2 ${
                    def.hideable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  title={def.hideable ? undefined : 'この列は非表示にできません'}
                >
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={col.visible}
                    disabled={!def.hideable}
                    onChange={() => toggleVisible(col.key)}
                  />
                  <span className="min-w-0 truncate font-medium text-gray-800">
                    {ganttColumnLabel(col.key)}
                  </span>
                </label>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    title="上へ"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    disabled={index === draft.length - 1}
                    onClick={() => move(index, 1)}
                    title="下へ"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between items-center pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-600 hover:text-sky-600"
          >
            既定に戻す
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1.5 text-sm rounded bg-sky-500 text-white hover:bg-sky-600"
            >
              適用
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
