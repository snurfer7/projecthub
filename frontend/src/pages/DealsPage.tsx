import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Deal, PaginatedDealsResponse } from '../types';
import { formatCompanyName } from '../utils/format';
import Combobox from '../components/Combobox';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const DEAL_STATUSES = [
  { value: 'prospecting', label: '見込み', color: 'bg-gray-100 text-gray-700' },
  { value: 'qualification', label: '評価中', color: 'bg-blue-100 text-blue-700' },
  { value: 'proposal', label: '提案中', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'negotiation', label: '交渉中', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'closed_won', label: '成約', color: 'bg-green-100 text-green-700' },
  { value: 'closed_lost', label: '失注', color: 'bg-red-100 text-red-700' },
];

const STATUS_COMBOBOX_OPTIONS = DEAL_STATUSES.map((s) => ({ value: s.value, label: s.label }));

function statusLabel(value: string): string {
  return DEAL_STATUSES.find((s) => s.value === value)?.label ?? value;
}

function statusColor(value: string): string {
  return DEAL_STATUSES.find((s) => s.value === value)?.color ?? 'bg-gray-100 text-gray-700';
}

function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
}

export default function DealsPage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [listQuery, setListQuery] = useState<{ page: number; pageSize: number; q: string; statuses: string[] }>({
    page: 1, pageSize: 50, q: '', statuses: [],
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      const nextQ = searchQuery.trim();
      setListQuery((prev) => {
        if (prev.q === nextQ) return prev;
        return { ...prev, page: 1, q: nextQ };
      });
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setListQuery((prev) => {
      const same =
        prev.statuses.length === statusFilter.length &&
        prev.statuses.every((s, i) => s === statusFilter[i]);
      if (same) return prev;
      return { ...prev, page: 1, statuses: statusFilter };
    });
  }, [statusFilter]);

  const loadDeals = useCallback(() => {
    const { page, pageSize, q, statuses } = listQuery;
    setLoading(true);
    api
      .get<PaginatedDealsResponse>('/crm/deals', {
        params: {
          page,
          pageSize,
          ...(q ? { q } : {}),
          ...(statuses.length > 0 ? { status: statuses.join(',') } : {}),
        },
      })
      .then((res) => {
        setDeals(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => {
        setDeals([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [listQuery]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const goToCompanyDeals = (companyId: number) => {
    navigate(`/companies/${companyId}?tab=deals`);
  };

  const { page, pageSize } = listQuery;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">商談</h1>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="商談名、企業名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2.5 text-sm w-72 min-h-[42px] hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
        />
        <Combobox
          label="ステータス"
          options={STATUS_COMBOBOX_OPTIONS}
          value={statusFilter}
          onChange={(v: string[]) => setStatusFilter(v)}
          isMulti
          className="w-60"
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">商談名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">企業</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">金額</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">確度</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">予定成約日</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">担当者</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  読み込み中…
                </td>
              </tr>
            ) : (
              deals.map((deal) => (
                <tr
                  key={deal.id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => goToCompanyDeals(deal.companyId)}
                >
                  <td className="px-4 py-3 font-medium text-sky-600">
                    {deal.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600" onClick={(e) => e.stopPropagation()}>
                    {deal.company ? (
                      <Link
                        to={`/companies/${deal.companyId}?tab=deals`}
                        className="text-sky-600 hover:underline"
                      >
                        {formatCompanyName(deal.company)}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(deal.status)}`}>
                      {statusLabel(deal.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatAmount(deal.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {deal.probability != null ? `${deal.probability}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {deal.expectedCloseDate
                      ? new Date(deal.expectedCloseDate).toLocaleDateString('ja-JP')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {deal.assignedTo
                      ? `${deal.assignedTo.lastName} ${deal.assignedTo.firstName}`
                      : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && deals.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {total === 0 && !listQuery.q && listQuery.statuses.length === 0
              ? '商談が登録されていません'
              : '該当する商談がありません'}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span>表示件数</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setListQuery((p) => ({ ...p, page: 1, pageSize: n }));
            }}
            className="border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          {total === 0
            ? '0 件'
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / 全 ${total} 件`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setListQuery((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
            className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            前へ
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setListQuery((p) => ({ ...p, page: p.page + 1 }))}
            className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}
