import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Contact, PaginatedContactsResponse } from '../types';
import { formatCompanyName, formatContactDisplayName } from '../utils/format';
import { buildCsv, downloadCsv } from '../utils/csv';
import { Download, MessageSquare } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function primaryDetails(contact: Contact) {
  const details = contact.details ?? [];
  const primary = details.filter((d) => d.isPrimary);
  return primary.length > 0 ? primary : details.slice(0, 1);
}

function joinDetailField(
  contact: Contact,
  pick: (d: NonNullable<Contact['details']>[number]) => string,
) {
  const details = primaryDetails(contact);
  if (details.length === 0) return '';
  return details.map(pick).filter(Boolean).join(' / ') || '';
}

function formatLocationAddress(
  location: NonNullable<NonNullable<Contact['details']>[number]['location']>,
) {
  return [location.prefecture, location.city, location.street, location.building]
    .filter(Boolean)
    .join('');
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listQuery, setListQuery] = useState({ page: 1, pageSize: 50, q: '' });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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

  const loadContacts = useCallback(() => {
    const { page, pageSize, q } = listQuery;
    setLoading(true);
    api
      .get<PaginatedContactsResponse>('/crm/contacts', {
        params: {
          page,
          pageSize,
          ...(q ? { q } : {}),
        },
      })
      .then((res) => {
        setContacts(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => {
        setContacts([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [listQuery]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const goToCompanyContacts = (companyId: number) => {
    navigate(`/companies/${companyId}?tab=contacts`);
  };

  /** 表示ページに関係なく、現在の検索語に一致する全連絡先を取得 */
  const fetchAllForExport = async (): Promise<Contact[]> => {
    const { q } = listQuery;
    const all: Contact[] = [];
    let page = 1;
    let pages = 1;
    do {
      const res = await api.get<PaginatedContactsResponse>('/crm/contacts', {
        params: {
          page,
          pageSize: 100,
          ...(q ? { q } : {}),
        },
      });
      all.push(...res.data.items);
      pages = res.data.totalPages;
      page += 1;
    } while (page <= pages);
    return all;
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllForExport();
      const header = [
        '姓',
        '名',
        '企業',
        '拠点',
        '郵便番号',
        '住所',
        '所属',
        '役職',
        '電話',
        'メール',
        '備考',
        'コメント数',
      ];
      const data = rows.map((c) => [
        c.lastName,
        c.firstName,
        c.company ? formatCompanyName(c.company) : '',
        joinDetailField(c, (d) => d.location?.name ?? ''),
        joinDetailField(c, (d) => d.location?.postalCode ?? ''),
        joinDetailField(c, (d) => (d.location ? formatLocationAddress(d.location) : '')),
        joinDetailField(c, (d) => d.department ?? ''),
        joinDetailField(c, (d) => d.position ?? ''),
        joinDetailField(c, (d) => d.phone ?? ''),
        joinDetailField(c, (d) => d.email ?? ''),
        c.notes ?? '',
        c._count?.comments ?? 0,
      ]);
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(`contacts_${date}.csv`, buildCsv([header, ...data]));
    } finally {
      setExporting(false);
    }
  };

  const { page, pageSize } = listQuery;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">連絡先</h1>

      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="氏名、企業名、所属、電話、メールで検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {exporting ? '出力中…' : 'CSV出力'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">企業</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">拠点</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">郵便番号</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">住所</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">所属</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">役職</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">電話</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  読み込み中…
                </td>
              </tr>
            ) : (
              contacts.map((c) => {
                const details = primaryDetails(c);
                return (
                  <tr
                    key={c.id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => goToCompanyContacts(c.companyId)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-sky-600">
                          {formatContactDisplayName(c.lastName, c.firstName)}
                        </span>
                        {(c._count?.comments ?? 0) > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium bg-sky-100 text-sky-700"
                            title="コメント"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {c._count!.comments}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600" onClick={(e) => e.stopPropagation()}>
                      {c.company ? (
                        <Link
                          to={`/companies/${c.companyId}?tab=contacts`}
                          className="text-sky-600 hover:underline"
                        >
                          {formatCompanyName(c.company)}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {details.length > 0
                        ? details.map((d, i) => (
                            <div key={i} className="text-xs">
                              {d.location?.name || '-'}
                            </div>
                          ))
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {details.length > 0
                        ? details.map((d, i) => (
                            <div key={i} className="text-xs">
                              {d.location?.postalCode || '-'}
                            </div>
                          ))
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {details.length > 0
                        ? details.map((d, i) => {
                            const address = d.location ? formatLocationAddress(d.location) : '';
                            return (
                              <div key={i} className="text-xs">
                                {address || '-'}
                              </div>
                            );
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {details.length > 0
                        ? details.map((d, i) => (
                            <div key={i} className="text-xs">
                              {d.department || '-'}
                            </div>
                          ))
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {details.length > 0
                        ? details.map((d, i) => (
                            <div key={i} className="text-xs">
                              {d.position || '-'}
                            </div>
                          ))
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {details.length > 0
                        ? details.map((d, i) => (
                            <div key={i} className="text-xs">
                              {d.phone || '-'}
                            </div>
                          ))
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {details.length > 0
                        ? details.map((d, i) => (
                            <div key={i} className="text-xs">
                              {d.email ? (
                                <a
                                  href={`mailto:${d.email}`}
                                  className="text-sky-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {d.email}
                                </a>
                              ) : (
                                '-'
                              )}
                            </div>
                          ))
                        : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!loading && contacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {total === 0 && !listQuery.q
              ? '連絡先が登録されていません'
              : '該当する連絡先がありません'}
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
