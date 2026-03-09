import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Company } from '../types';
import CompanyModal from '../components/CompanyModal';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Company modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  const loadCompanies = () => {
    api.get('/admin/companies').then((res) => setCompanies(res.data));
  };

  useEffect(() => { loadCompanies(); }, []);

  const openCreateCompanyModal = () => {
    setShowCompanyModal(true);
  };

  const closeCompanyModal = () => {
    setShowCompanyModal(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">会社</h1>

      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="会社名、電話番号、住所で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button onClick={openCreateCompanyModal}
          className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
          新規会社
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">会社名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">電話番号</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">住所</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">プロジェクト数</th>
            </tr>
          </thead>
          <tbody>
            {companies.filter((c) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return c.name.toLowerCase().includes(q)
                || (c.phone && c.phone.toLowerCase().includes(q))
                || (c.postalCode && c.postalCode.toLowerCase().includes(q))
                || (c.prefecture && c.prefecture.toLowerCase().includes(q))
                || (c.city && c.city.toLowerCase().includes(q))
                || (c.street && c.street.toLowerCase().includes(q))
                || (c.building && c.building.toLowerCase().includes(q));
            }).map((company) => (
              <tr key={company.id} className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/companies/${company.id}`)}>
                <td className="px-4 py-3 text-sky-600 font-medium">{company.name}</td>
                <td className="px-4 py-3 text-gray-600">{company.phone || '-'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {company.postalCode && `〒${company.postalCode} `}
                  {company.prefecture}{company.city}{company.street}{company.building}
                  {!company.postalCode && !company.prefecture && !company.city && !company.street && !company.building && '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">{company._count?.projects || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {companies.length === 0 && (
          <div className="text-center py-8 text-gray-500">会社が登録されていません</div>
        )}
      </div>

      <CompanyModal
        isOpen={showCompanyModal}
        onClose={closeCompanyModal}
        onSuccess={loadCompanies}
      />
    </div>
  );
}
