import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Company, PaginatedCompaniesResponse } from '../types';
import CompanyModal from '../components/CompanyModal';
import { formatCompanyName } from '../utils/format';
import {
  COMPANIES_LIST_STORAGE_KEY,
  COMPANIES_LIST_RESET_EVENT,
  readPersistedCompaniesList,
  defaultCompaniesListQuery,
  type CompaniesListQuery,
  type PersistedCompaniesList,
} from '../utils/companiesListStorage';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export default function CompaniesPage() {
  const navigate = useNavigate();
  const persistedList = useMemo(() => readPersistedCompaniesList(), []);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => persistedList?.searchQuery ?? '');
  const [listQuery, setListQuery] = useState<CompaniesListQuery>(
    () => persistedList?.listQuery ?? defaultCompaniesListQuery(),
  );
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showLegalEntity, setShowLegalEntity] = useState(
    () => persistedList?.showLegalEntity ?? true,
  );

  const [showCompanyModal, setShowCompanyModal] = useState(false);

  useEffect(() => {
    try {
      const payload: PersistedCompaniesList = {
        v: 1,
        searchQuery,
        listQuery,
        showLegalEntity,
      };
      sessionStorage.setItem(COMPANIES_LIST_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota / private mode
    }
  }, [searchQuery, listQuery, showLegalEntity]);

  useEffect(() => {
    const onReset = () => {
      setSearchQuery('');
      setListQuery(defaultCompaniesListQuery());
      setShowLegalEntity(true);
    };
    window.addEventListener(COMPANIES_LIST_RESET_EVENT, onReset);
    return () => window.removeEventListener(COMPANIES_LIST_RESET_EVENT, onReset);
  }, []);

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

  const loadCompanies = useCallback(() => {
    const { page, pageSize, q } = listQuery;
    setLoading(true);
    api
      .get<PaginatedCompaniesResponse>('/companies', {
        params: {
          page,
          pageSize,
          ...(q ? { q } : {}),
        },
      })
      .then((res) => {
        setCompanies(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => {
        setCompanies([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [listQuery]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const openCreateCompanyModal = () => {
    setShowCompanyModal(true);
  };

  const closeCompanyModal = () => {
    setShowCompanyModal(false);
  };

  const { page, pageSize } = listQuery;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">企業</h1>

      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="企業名、電話番号、住所で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button onClick={openCreateCompanyModal}
          className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
          新規企業
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                <div className="flex items-center gap-2">
                  <span>企業名</span>
                  <label className="flex items-center gap-1 font-normal text-xs text-gray-400 cursor-pointer select-none">
                    (
                    <input
                      type="checkbox"
                      checked={showLegalEntity}
                      onChange={(e) => setShowLegalEntity(e.target.checked)}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                    />
                    法人格)
                  </label>
                </div>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">電話番号</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">住所</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">プロジェクト数</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                  読み込み中…
                </td>
              </tr>
            ) : (
              companies.map((company) => {
                const mainLocation =
                  company.locations && company.locations.length > 0 ? company.locations[0] : null;
                return (
                  <tr
                    key={company.id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <td className="px-4 py-3 text-sky-600 font-medium">
                      {showLegalEntity ? formatCompanyName(company) : company.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{mainLocation?.phone || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {mainLocation?.postalCode && `〒${mainLocation.postalCode} `}
                      {mainLocation?.prefecture}
                      {mainLocation?.city}
                      {mainLocation?.street}
                      {mainLocation?.building}
                      {!mainLocation && '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{company._count?.projects || 0}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!loading && companies.length === 0 && (
          <div className="text-center py-8 text-gray-500">該当する企業がありません</div>
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

      <CompanyModal
        isOpen={showCompanyModal}
        onClose={closeCompanyModal}
        onSuccess={loadCompanies}
      />
    </div>
  );
}
