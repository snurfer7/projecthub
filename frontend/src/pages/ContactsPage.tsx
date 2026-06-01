import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Contact } from '../types';
import { formatCompanyName, formatContactDisplayName } from '../utils/format';
import { buildCsv, downloadCsv } from '../utils/csv';
import { Download, MessageSquare } from 'lucide-react';

function primaryDetails(contact: Contact) {
  const details = contact.details ?? [];
  const primary = details.filter((d) => d.isPrimary);
  return primary.length > 0 ? primary : details.slice(0, 1);
}

function contactMatchesQuery(contact: Contact, q: string): boolean {
  const lower = q.toLowerCase();
  const name = formatContactDisplayName(contact.lastName, contact.firstName).toLowerCase();
  const company = (contact.company?.name ?? '').toLowerCase();
  if (name.includes(lower) || company.includes(lower)) return true;
  for (const d of contact.details ?? []) {
    const fields = [d.department, d.position, d.phone, d.email, d.location?.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (fields.includes(lower)) return true;
  }
  return false;
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(() => {
    setLoading(true);
    api
      .get<Contact[]>('/crm/contacts')
      .then((res) => setContacts(res.data))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return contacts;
    return contacts.filter((c) => contactMatchesQuery(c, q));
  }, [contacts, searchQuery]);

  const goToCompanyContacts = (companyId: number) => {
    navigate(`/companies/${companyId}?tab=contacts`);
  };

  const joinDetailField = (contact: Contact, pick: (d: NonNullable<Contact['details']>[number]) => string) => {
    const details = primaryDetails(contact);
    if (details.length === 0) return '';
    return details.map(pick).filter(Boolean).join(' / ') || '';
  };

  const exportCsv = () => {
    const header = ['姓', '名', '企業', '拠点', '所属', '役職', '電話', 'メール', '備考', 'コメント数'];
    const rows = filteredContacts.map((c) => [
      c.lastName,
      c.firstName,
      c.company ? formatCompanyName(c.company) : '',
      joinDetailField(c, (d) => d.location?.name ?? ''),
      joinDetailField(c, (d) => d.department ?? ''),
      joinDetailField(c, (d) => d.position ?? ''),
      joinDetailField(c, (d) => d.phone ?? ''),
      joinDetailField(c, (d) => d.email ?? ''),
      c.notes ?? '',
      c._count?.comments ?? 0,
    ]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`contacts_${date}.csv`, buildCsv([header, ...rows]));
  };

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
          <span className="text-sm text-gray-500">
            {loading ? '読み込み中…' : `全 ${filteredContacts.length} 件`}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || filteredContacts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            CSV出力
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">所属</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">役職</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">電話</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
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
              filteredContacts.map((c) => {
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
        {!loading && filteredContacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {contacts.length === 0
              ? '連絡先が登録されていません'
              : '該当する連絡先がありません'}
          </div>
        )}
      </div>
    </div>
  );
}
