import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Modal from './Modal';
import {
  DEFAULT_ISSUE_LIST_SORT,
  ISSUE_LIST_SORT_OPTIONS,
  createIssueSortEntry,
  isOptionalIssueSortKey,
  type IssueListEmptyPlacement,
  type IssueListSort,
  type IssueListSortDirection,
  type IssueListSortKey,
} from '../utils/issueSort';

interface IssueListSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: IssueListSort[];
  onApply: (sort: IssueListSort[]) => void;
}

function sortLabel(key: IssueListSortKey): string {
  return ISSUE_LIST_SORT_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function not(a: readonly IssueListSortKey[], b: readonly IssueListSortKey[]) {
  return a.filter((value) => !b.includes(value));
}

function intersection(a: readonly IssueListSortKey[], b: readonly IssueListSortKey[]) {
  return a.filter((value) => b.includes(value));
}

function union(a: readonly IssueListSortKey[], b: readonly IssueListSortKey[]) {
  return [...a, ...not(b, a)];
}

export default function IssueListSortModal({
  isOpen,
  onClose,
  value,
  onApply,
}: IssueListSortModalProps) {
  const allKeys = useMemo(() => ISSUE_LIST_SORT_OPTIONS.map((o) => o.key), []);

  const [chosen, setChosen] = useState<IssueListSort[]>([...DEFAULT_ISSUE_LIST_SORT]);
  const [checkedLeft, setCheckedLeft] = useState<IssueListSortKey[]>([]);
  const [checkedRight, setCheckedRight] = useState<IssueListSortKey[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const next: IssueListSort[] =
      value.length > 0
        ? value.map((s) =>
            isOptionalIssueSortKey(s.key)
              ? {
                  ...s,
                  emptyPlacement: (s.emptyPlacement === 'first' ? 'first' : 'last') as IssueListEmptyPlacement,
                }
              : { key: s.key, direction: s.direction },
          )
        : [...DEFAULT_ISSUE_LIST_SORT];
    setChosen(next);
    setCheckedLeft([]);
    setCheckedRight([]);
  }, [isOpen, value]);

  const chosenKeys = chosen.map((s) => s.key);
  const leftKeys = not(allKeys, chosenKeys);

  const leftChecked = intersection(checkedLeft, leftKeys);
  const rightChecked = intersection(checkedRight, chosenKeys);

  const handleToggle =
    (list: 'left' | 'right', key: IssueListSortKey) =>
    () => {
      if (list === 'left') {
        setCheckedLeft((prev) =>
          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );
      } else {
        setCheckedRight((prev) =>
          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );
      }
    };

  const handleToggleAllLeft = () => {
    setCheckedLeft((prev) => (prev.length === leftKeys.length ? [] : [...leftKeys]));
  };

  const handleToggleAllRight = () => {
    setCheckedRight((prev) => (prev.length === chosenKeys.length ? [] : [...chosenKeys]));
  };

  const moveCheckedToRight = () => {
    const moving = leftChecked;
    if (moving.length === 0) return;
    setChosen((prev) => [...prev, ...moving.map((key) => createIssueSortEntry(key))]);
    setCheckedLeft((prev) => not(prev, moving));
    setCheckedRight((prev) => union(prev, moving));
  };

  const moveCheckedToLeft = () => {
    const moving = rightChecked;
    if (moving.length === 0) return;
    setChosen((prev) => prev.filter((s) => !moving.includes(s.key)));
    setCheckedRight((prev) => not(prev, moving));
    setCheckedLeft((prev) => union(prev, moving));
  };

  const moveAllToRight = () => {
    setChosen((prev) => [...prev, ...leftKeys.map((key) => createIssueSortEntry(key))]);
    setCheckedLeft([]);
  };

  const moveAllToLeft = () => {
    setChosen([]);
    setCheckedRight([]);
  };

  const setDirection = (key: IssueListSortKey, direction: IssueListSortDirection) => {
    setChosen((prev) => prev.map((s) => (s.key === key ? { ...s, direction } : s)));
  };

  const setEmptyPlacement = (key: IssueListSortKey, emptyPlacement: IssueListEmptyPlacement) => {
    setChosen((prev) => prev.map((s) => (s.key === key ? { ...s, emptyPlacement } : s)));
  };

  const movePriority = (key: IssueListSortKey, delta: -1 | 1) => {
    setChosen((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx < 0) return prev;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(nextIdx, 0, item);
      return next;
    });
  };

  const handleApply = () => {
    onApply(chosen.length > 0 ? chosen : [...DEFAULT_ISSUE_LIST_SORT]);
    onClose();
  };

  const listBoxClass =
    'w-full min-h-[16rem] max-h-[20rem] overflow-y-auto border border-gray-200 rounded-md bg-white';

  const transferBtnClass =
    'w-10 h-8 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="チケットの並び替え"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700"
          >
            適用
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 mb-4">
        左側から並び替えに使う項目を選び、右側で優先順位と昇順・降順を設定します。右側の上にある項目ほど優先されます。子チケットは親の配下にまとめたまま、兄弟間で同じ条件で並び替えます。カンバンでは各列内の末端チケットに、時間表示ではプロジェクト配下のチケットに適用します。
      </p>

      <div className="flex flex-col sm:flex-row items-stretch gap-3">
        {/* Choices (left) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <input
              type="checkbox"
              checked={leftKeys.length > 0 && leftChecked.length === leftKeys.length}
              ref={(el) => {
                if (el) {
                  el.indeterminate =
                    leftChecked.length > 0 && leftChecked.length < leftKeys.length;
                }
              }}
              onChange={handleToggleAllLeft}
              disabled={leftKeys.length === 0}
              className="rounded border-gray-300"
              aria-label="選択可能項目をすべて選択"
            />
            <span className="text-sm font-medium text-slate-700">選択可能</span>
            <span className="text-xs text-gray-400 ml-auto">
              {leftChecked.length}/{leftKeys.length}
            </span>
          </div>
          <ul className={listBoxClass} role="listbox" aria-label="選択可能項目">
            {leftKeys.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-gray-400">項目がありません</li>
            ) : (
              leftKeys.map((key) => (
                <li key={key} className="border-b border-gray-100 last:border-0">
                  <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checkedLeft.includes(key)}
                      onChange={handleToggle('left', key)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-slate-800">{sortLabel(key)}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Transfer buttons */}
        <div className="flex sm:flex-col items-center justify-center gap-1.5 shrink-0 py-2">
          <button
            type="button"
            className={transferBtnClass}
            onClick={moveAllToRight}
            disabled={leftKeys.length === 0}
            title="すべて追加"
            aria-label="すべて追加"
          >
            ≫
          </button>
          <button
            type="button"
            className={transferBtnClass}
            onClick={moveCheckedToRight}
            disabled={leftChecked.length === 0}
            title="追加"
            aria-label="追加"
          >
            &gt;
          </button>
          <button
            type="button"
            className={transferBtnClass}
            onClick={moveCheckedToLeft}
            disabled={rightChecked.length === 0}
            title="除外"
            aria-label="除外"
          >
            &lt;
          </button>
          <button
            type="button"
            className={transferBtnClass}
            onClick={moveAllToLeft}
            disabled={chosenKeys.length === 0}
            title="すべて除外"
            aria-label="すべて除外"
          >
            ≪
          </button>
        </div>

        {/* Chosen (right) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <input
              type="checkbox"
              checked={chosenKeys.length > 0 && rightChecked.length === chosenKeys.length}
              ref={(el) => {
                if (el) {
                  el.indeterminate =
                    rightChecked.length > 0 && rightChecked.length < chosenKeys.length;
                }
              }}
              onChange={handleToggleAllRight}
              disabled={chosenKeys.length === 0}
              className="rounded border-gray-300"
              aria-label="選択済み項目をすべて選択"
            />
            <span className="text-sm font-medium text-slate-700">並び替え項目</span>
            <span className="text-xs text-gray-400 ml-auto">
              {rightChecked.length}/{chosenKeys.length}
            </span>
          </div>
          <ul className={listBoxClass} role="listbox" aria-label="並び替え項目">
            {chosen.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-gray-400">項目を追加してください</li>
            ) : (
              chosen.map((item, index) => (
                <li key={item.key} className="border-b border-gray-100 last:border-0">
                  <div className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checkedRight.includes(item.key)}
                      onChange={handleToggle('right', item.key)}
                      className="rounded border-gray-300 mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-semibold text-slate-500 tabular-nums w-4">
                          {index + 1}
                        </span>
                        <span className="text-sm text-slate-800">{sortLabel(item.key)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5">
                        <label className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                          <input
                            type="radio"
                            name={`dir-${item.key}`}
                            checked={item.direction === 'asc'}
                            onChange={() => setDirection(item.key, 'asc')}
                            className="border-gray-300"
                          />
                          昇順
                        </label>
                        <label className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                          <input
                            type="radio"
                            name={`dir-${item.key}`}
                            checked={item.direction === 'desc'}
                            onChange={() => setDirection(item.key, 'desc')}
                            className="border-gray-300"
                          />
                          降順
                        </label>
                        {isOptionalIssueSortKey(item.key) && (
                          <>
                            <span className="text-gray-300" aria-hidden>
                              ／
                            </span>
                            <span className="text-[11px] text-gray-400 shrink-0">省略時</span>
                            <label className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="radio"
                                name={`empty-${item.key}`}
                                checked={(item.emptyPlacement ?? 'last') === 'first'}
                                onChange={() => setEmptyPlacement(item.key, 'first')}
                                className="border-gray-300"
                              />
                              先頭
                            </label>
                            <label className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="radio"
                                name={`empty-${item.key}`}
                                checked={(item.emptyPlacement ?? 'last') === 'last'}
                                onChange={() => setEmptyPlacement(item.key, 'last')}
                                className="border-gray-300"
                              />
                              末尾
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => movePriority(item.key, -1)}
                        title="優先度を上げる"
                        aria-label={`${sortLabel(item.key)}の優先度を上げる`}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                        disabled={index === chosen.length - 1}
                        onClick={() => movePriority(item.key, 1)}
                        title="優先度を下げる"
                        aria-label={`${sortLabel(item.key)}の優先度を下げる`}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
