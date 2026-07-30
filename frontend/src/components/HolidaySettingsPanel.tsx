import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, Plus, Trash2 } from 'lucide-react';
import api from '../api/client';
import { HolidayDateEntry, HolidaySettings, User } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import Modal from './Modal';
import TextInput from './TextInput';

const NATIONAL_HOLIDAYS_URL = 'https://holidays-jp.github.io/api/v1/date.json';

/** 表示順: 月〜日。値は JS getDay()（0=日〜6=土） */
const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
  { value: 0, label: '日' },
];

interface Props {
  user: User;
}

function sortEntries(entries: HolidayDateEntry[]): HolidayDateEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function upsertEntries(existing: HolidayDateEntry[], incoming: HolidayDateEntry[]): HolidayDateEntry[] {
  const map = new Map(existing.map((e) => [e.date, e.name]));
  for (const e of incoming) {
    map.set(e.date, e.name);
  }
  return sortEntries([...map.entries()].map(([date, name]) => ({ date, name })));
}

export default function HolidaySettingsPanel({ user }: Props) {
  const { canInput } = usePermissions(user.permissions);
  const canEdit = canInput('admin.holiday-settings');

  const [holidayWeekdays, setHolidayWeekdays] = useState<number[]>([0, 6]);
  const [holidays, setHolidays] = useState<HolidayDateEntry[]>([]);
  const [workdays, setWorkdays] = useState<HolidayDateEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [workdayDate, setWorkdayDate] = useState('');
  const [workdayName, setWorkdayName] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importByYear, setImportByYear] = useState<Record<string, HolidayDateEntry[]>>({});
  const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<HolidaySettings>('/admin/settings/holidays');
      setHolidayWeekdays(res.data.holidayWeekdays ?? [0, 6]);
      setHolidays(sortEntries(res.data.holidays ?? []));
      setWorkdays(sortEntries(res.data.workdays ?? []));
    } catch (err: unknown) {
      console.error('Failed to fetch holiday settings:', err);
      setError('設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleWeekday = (day: number) => {
    if (!canEdit) return;
    setHolidayWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const handleAddHoliday = () => {
    if (!canEdit) return;
    const date = holidayDate.trim();
    const name = holidayName.trim();
    if (!date || !name) {
      setError('休日の日付と名称を入力してください');
      return;
    }
    setError('');
    setHolidays((prev) => upsertEntries(prev, [{ date, name }]));
    setHolidayDate('');
    setHolidayName('');
  };

  const handleAddWorkday = () => {
    if (!canEdit) return;
    const date = workdayDate.trim();
    const name = workdayName.trim();
    if (!date || !name) {
      setError('出勤日の日付と名称を入力してください');
      return;
    }
    setError('');
    setWorkdays((prev) => upsertEntries(prev, [{ date, name }]));
    setWorkdayDate('');
    setWorkdayName('');
  };

  const handleSave = async () => {
    if (!canEdit) return;
    try {
      setLoading(true);
      setMessage('');
      setError('');
      const res = await api.put<HolidaySettings>('/admin/settings/holidays', {
        holidayWeekdays,
        holidays,
        workdays,
      });
      setHolidayWeekdays(res.data.holidayWeekdays);
      setHolidays(sortEntries(res.data.holidays));
      setWorkdays(sortEntries(res.data.workdays));
      setMessage('設定を保存しました');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; details?: string } } })?.response?.data;
      setError(data?.details || data?.error || '設定の保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchNationalHolidays = async () => {
    if (!canEdit) return;
    try {
      setImportLoading(true);
      setImportError('');
      const res = await fetch(NATIONAL_HOLIDAYS_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Record<string, string>;
      const byYear: Record<string, HolidayDateEntry[]> = {};
      for (const [date, name] of Object.entries(data)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof name !== 'string') continue;
        const year = date.slice(0, 4);
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push({ date, name });
      }
      for (const year of Object.keys(byYear)) {
        byYear[year] = sortEntries(byYear[year]);
      }
      const years = Object.keys(byYear).sort();
      if (years.length === 0) {
        setImportError('取得データが空でした');
        return;
      }
      setImportByYear(byYear);
      setSelectedYears(new Set(years));
      setImportOpen(true);
    } catch (err: unknown) {
      console.error('Failed to fetch national holidays:', err);
      setImportError('祝日データの取得に失敗しました');
    } finally {
      setImportLoading(false);
    }
  };

  const toggleYear = (year: string) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const handleConfirmImport = () => {
    const incoming: HolidayDateEntry[] = [];
    for (const year of selectedYears) {
      const list = importByYear[year];
      if (list) incoming.push(...list);
    }
    setHolidays((prev) => upsertEntries(prev, incoming));
    setImportOpen(false);
    setMessage(`${selectedYears.size} 年分の休日を一覧に反映しました（保存ボタンで確定）`);
  };

  const importYears = useMemo(() => Object.keys(importByYear).sort(), [importByYear]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6 border-b pb-4">
          <CalendarDays className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-800">休日設定</h2>
        </div>

        {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        {importError && !importOpen && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{importError}</div>
        )}

        {/* ① 曜日 */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">曜日の休日</h3>
          <p className="text-xs text-gray-500 mb-3">休日にする曜日を選択します（初期: 土・日）。</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map(({ value, label }) => {
              const active = holidayWeekdays.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleWeekday(value)}
                  className={`w-11 h-11 rounded-md text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-600 border-gray-300 hover:border-sky-400'
                  }`}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ② 個別休日 */}
        <section className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-700">個別の休日</h3>
            <button
              type="button"
              disabled={!canEdit || importLoading}
              onClick={() => void handleFetchNationalHolidays()}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-sky-300 border-t-sky-700 rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              データ取得
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            祝日・振替休日など、特定日の休日を設定します。データ取得では国民の祝日一覧をプレビュー表示します。
          </p>

          {canEdit && (
            <div className="flex flex-wrap gap-2 mb-3 items-end">
              <div className="w-40">
                <TextInput
                  label="日付"
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  showFloatingLabel={false}
                  size="small"
                />
              </div>
              <div className="flex-1 min-w-[10rem]">
                <TextInput
                  label="名称"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="例: 会社創立記念日"
                  showFloatingLabel={false}
                  size="small"
                />
              </div>
              <button
                type="button"
                onClick={handleAddHoliday}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          )}

          <DateEntryList
            entries={holidays}
            emptyLabel="個別休日はまだありません"
            canEdit={canEdit}
            onRemove={(date) => setHolidays((prev) => prev.filter((e) => e.date !== date))}
          />
        </section>

        {/* ③ 個別出勤 */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">個別の出勤</h3>
          <p className="text-xs text-gray-500 mb-3">
            曜日休日・個別休日でも出勤とする例外日です（判定時は出勤日が最優先）。
          </p>

          {canEdit && (
            <div className="flex flex-wrap gap-2 mb-3 items-end">
              <div className="w-40">
                <TextInput
                  label="日付"
                  type="date"
                  value={workdayDate}
                  onChange={(e) => setWorkdayDate(e.target.value)}
                  showFloatingLabel={false}
                  size="small"
                />
              </div>
              <div className="flex-1 min-w-[10rem]">
                <TextInput
                  label="名称"
                  value={workdayName}
                  onChange={(e) => setWorkdayName(e.target.value)}
                  placeholder="例: 稼働日"
                  showFloatingLabel={false}
                  size="small"
                />
              </div>
              <button
                type="button"
                onClick={handleAddWorkday}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          )}

          <DateEntryList
            entries={workdays}
            emptyLabel="個別出勤日はまだありません"
            canEdit={canEdit}
            onRemove={(date) => setWorkdays((prev) => prev.filter((e) => e.date !== date))}
          />
        </section>

        {canEdit && (
          <div className="border-t pt-6">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading}
              className="w-full bg-sky-600 text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex justify-center items-center"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  保存中...
                </>
              ) : (
                '設定を保存'
              )}
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="国民の祝日データ取込"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-slate-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedYears.size === 0}
              className="px-4 py-2 text-sm rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
            >
              選択した年を取り込む
            </button>
          </div>
        }
      >
        {importError && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded text-sm">{importError}</div>}
        <p className="text-sm text-gray-600 mb-4">
          取り込む年を選択してください。確定後は画面上の休日一覧に反映され、保存ボタンで永続化します。
        </p>
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {importYears.map((year) => {
            const entries = importByYear[year] ?? [];
            const checked = selectedYears.has(year);
            return (
              <div key={year} className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleYear(year)}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="font-semibold text-slate-800">{year}年</span>
                  <span className="text-xs text-gray-500">{entries.length} 件</span>
                </label>
                <ul className="divide-y max-h-40 overflow-y-auto">
                  {entries.map((e) => (
                    <li key={e.date} className="px-4 py-1.5 text-sm flex justify-between gap-4 text-slate-700">
                      <span className="font-mono text-xs text-gray-500">{e.date}</span>
                      <span className="flex-1 text-right">{e.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function DateEntryList({
  entries,
  emptyLabel,
  canEdit,
  onRemove,
}: {
  entries: HolidayDateEntry[];
  emptyLabel: string;
  canEdit: boolean;
  onRemove: (date: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 py-2">{emptyLabel}</p>;
  }
  return (
    <ul className="border rounded-lg divide-y max-h-64 overflow-y-auto">
      {entries.map((e) => (
        <li key={e.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="min-w-0">
            <span className="font-mono text-xs text-gray-500 mr-3">{e.date}</span>
            <span className="text-slate-800">{e.name}</span>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => onRemove(e.date)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded shrink-0"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
