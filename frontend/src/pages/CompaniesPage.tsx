import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Company } from '../types';
import CompanyModal from '../components/CompanyModal';
import { formatCompanyName } from '../utils/format';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLegalEntity, setShowLegalEntity] = useState(true);

  // Company modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  const loadCompanies = () => {
    api.get('/companies').then((res) => setCompanies(res.data));
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
            {companies.filter((c) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              const mainLocation = c.locations && c.locations.length > 0 ? c.locations[0] : null;
              
              const addressMatch = mainLocation ? (
                   (mainLocation.postalCode && mainLocation.postalCode.toLowerCase().includes(q))
                || (mainLocation.prefecture && mainLocation.prefecture.toLowerCase().includes(q))
                || (mainLocation.city && mainLocation.city.toLowerCase().includes(q))
                || (mainLocation.street && mainLocation.street.toLowerCase().includes(q))
                || (mainLocation.building && mainLocation.building.toLowerCase().includes(q))
              ) : false;

              return c.name.toLowerCase().includes(q)
                || (mainLocation?.phone && mainLocation.phone.toLowerCase().includes(q))
                || (mainLocation?.fax && mainLocation.fax.toLowerCase().includes(q))
                || addressMatch;
            }).map((company) => {
              const mainLocation = company.locations && company.locations.length > 0 ? company.locations[0] : null;
              return (
              <tr key={company.id} className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/companies/${company.id}`)}>
                <td className="px-4 py-3 text-sky-600 font-medium">
                  {showLegalEntity ? formatCompanyName(company) : company.name}
                </td>
                <td className="px-4 py-3 text-gray-600">{mainLocation?.phone || '-'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {mainLocation?.postalCode && `〒${mainLocation.postalCode} `}
                  {mainLocation?.prefecture}{mainLocation?.city}{mainLocation?.street}{mainLocation?.building}
                  {!mainLocation && '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">{company._count?.projects || 0}</td>
              </tr>
            );
          })}
          </tbody>
        </table>
        {companies.length === 0 && (
          <div className="text-center py-8 text-gray-500">企業が登録されていません</div>
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
