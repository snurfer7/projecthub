import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Company, Contact, Deal, Activity, Association } from '../types';
import { Pencil, Trash2, MessageSquare } from 'lucide-react';
import CompanyModal from '../components/CompanyModal';
import Modal from '../components/Modal';
import CompanyWikiTab from '../components/CompanyWikiTab';
import CompanyCommentsTab from '../components/CompanyCommentsTab';
import ContactCommentsSection from '../components/ContactCommentsSection';


const DEAL_STATUSES: { value: string; label: string; color: string }[] = [
  { value: 'prospecting', label: '見込み', color: 'bg-gray-100 text-gray-700' },
  { value: 'qualification', label: '評価中', color: 'bg-blue-100 text-blue-700' },
  { value: 'proposal', label: '提案中', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'negotiation', label: '交渉中', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'closed_won', label: '成約', color: 'bg-green-100 text-green-700' },
  { value: 'closed_lost', label: '失注', color: 'bg-red-100 text-red-700' },
];

const ACTIVITY_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'call', label: '電話', icon: '📞' },
  { value: 'email', label: 'メール', icon: '✉️' },
  { value: 'visit', label: '訪問', icon: '🏢' },
  { value: 'meeting', label: '会議', icon: '👥' },
  { value: 'memo', label: 'メモ', icon: '📝' },
];

function getDealStatusBadge(status: string) {
  const s = DEAL_STATUSES.find((d) => d.value === status);
  return s ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.label}</span> : status;
}

function getActivityIcon(type: string) {
  const a = ACTIVITY_TYPES.find((t) => t.value === type);
  return a ? a.icon : '📋';
}

function getActivityLabel(type: string) {
  const a = ACTIVITY_TYPES.find((t) => t.value === type);
  return a ? a.label : type;
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const activeTab = (query.get('tab') || 'overview') as 'overview' | 'contacts' | 'deals' | 'activities' | 'projects' | 'wiki' | 'comments';

  const setActiveTab = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', notes: '' });
  const [contactDetails, setContactDetails] = useState<{ department: string; position: string; phone: string; email: string; isPrimary: boolean }[]>([]);
  const [contactError, setContactError] = useState('');
  const [commentContact, setCommentContact] = useState<Contact | null>(null);

  // Deals
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealForm, setDealForm] = useState({ name: '', amount: '', status: 'prospecting', probability: '', expectedCloseDate: '', contactId: '', assignedToId: '', notes: '' });
  const [dealError, setDealError] = useState('');
  const [users, setUsers] = useState<{ id: number; firstName: string; lastName: string }[]>([]);

  // Company Edit
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  // Activities
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', subject: '', description: '', contactId: '', dealId: '', dueDate: '', completed: false });
  const [activityError, setActivityError] = useState('');

  // Associations
  const [masterAssociations, setMasterAssociations] = useState<Association[]>([]);
  const [assignedAssociations, setAssignedAssociations] = useState<{ id: number; association: Association }[]>([]);
  const [showAddAssociationModal, setShowAddAssociationModal] = useState(false);
  const [newAssociationId, setNewAssociationId] = useState('');

  const companyId = Number(id);

  const loadCompany = () => api.get(`/admin/companies/${id}`).then((res) => {
    setCompany(res.data);
    setAssignedAssociations(res.data.associations || []);
  });
  const loadContacts = () => api.get(`/crm/contacts?companyId=${id}`).then((res) => setContacts(res.data));
  const loadDeals = () => api.get(`/crm/deals?companyId=${id}`).then((res) => setDeals(res.data));
  const loadActivities = () => api.get(`/crm/activities?companyId=${id}`).then((res) => setActivities(res.data));
  const loadMasterAssociations = () => api.get('/admin/associations').then((res) => setMasterAssociations(res.data));
  const loadUsers = () => api.get('/admin/users').then((res) => setUsers(res.data.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName }))));

  useEffect(() => {
    loadCompany();
    loadContacts();
    loadDeals();
    loadActivities();
    loadMasterAssociations();
    loadUsers();
  }, [id]);

  const handleDeleteCompany = async () => {
    if (!confirm('この会社を削除しますか？')) return;
    try {
      await api.delete(`/admin/companies/${id}`);
      navigate('/companies');
    } catch (err: any) {
      alert(err.response?.data?.error || '削除に失敗しました');
    }
  };

  // ========== Contact handlers ==========
  const openCreateContact = () => {
    setEditingContact(null);
    setContactForm({ firstName: '', lastName: '', notes: '' });
    setContactDetails([{ department: '', position: '', phone: '', email: '', isPrimary: false }]);
    setContactError('');
    setShowContactModal(true);
  };

  const openEditContact = (c: Contact) => {
    setEditingContact(c);
    setContactForm({ firstName: c.firstName, lastName: c.lastName, notes: c.notes || '' });
    setContactDetails((c.details && c.details.length > 0) ? c.details.map(d => ({
      department: d.department || '',
      position: d.position || '',
      phone: d.phone || '',
      email: d.email || '',
      isPrimary: d.isPrimary || false
    })) : [{ department: '', position: '', phone: '', email: '', isPrimary: false }]);
    setContactError('');
    setShowContactModal(true);
  };

  const handleSubmitContact = async (e: FormEvent) => {
    e.preventDefault();
    setContactError('');
    try {
      const data = {
        ...contactForm,
        companyId,
        notes: contactForm.notes || null,
        details: contactDetails.filter(d => d.department || d.position || d.phone || d.email),
      };
      if (editingContact) {
        await api.put(`/crm/contacts/${editingContact.id}`, data);
      } else {
        await api.post('/crm/contacts', data);
      }
      setShowContactModal(false);
      loadContacts();
    } catch (err: any) {
      setContactError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const handleDeleteContact = async (cId: number) => {
    if (!confirm('この連絡先を削除しますか？')) return;
    await api.delete(`/crm/contacts/${cId}`);
    loadContacts();
  };

  // ========== Deal handlers ==========
  const openCreateDeal = () => {
    setEditingDeal(null);
    setDealForm({ name: '', amount: '', status: 'prospecting', probability: '', expectedCloseDate: '', contactId: '', assignedToId: '', notes: '' });
    setDealError('');
    setShowDealModal(true);
  };

  const openEditDeal = (d: Deal) => {
    setEditingDeal(d);
    setDealForm({
      name: d.name, amount: d.amount?.toString() || '', status: d.status,
      probability: d.probability?.toString() || '', expectedCloseDate: d.expectedCloseDate?.split('T')[0] || '',
      contactId: d.contactId?.toString() || '', assignedToId: d.assignedToId?.toString() || '', notes: d.notes || '',
    });
    setDealError('');
    setShowDealModal(true);
  };

  const handleSubmitDeal = async (e: FormEvent) => {
    e.preventDefault();
    setDealError('');
    try {
      const data = {
        companyId, name: dealForm.name, status: dealForm.status,
        amount: dealForm.amount ? parseFloat(dealForm.amount) : null,
        probability: dealForm.probability ? parseInt(dealForm.probability) : null,
        expectedCloseDate: dealForm.expectedCloseDate || null,
        contactId: dealForm.contactId ? parseInt(dealForm.contactId) : null,
        assignedToId: dealForm.assignedToId ? parseInt(dealForm.assignedToId) : null,
        notes: dealForm.notes || null,
      };
      if (editingDeal) {
        await api.put(`/crm/deals/${editingDeal.id}`, data);
      } else {
        await api.post('/crm/deals', data);
      }
      setShowDealModal(false);
      loadDeals();
    } catch (err: any) {
      setDealError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const handleDeleteDeal = async (dId: number) => {
    if (!confirm('この商談を削除しますか？')) return;
    await api.delete(`/crm/deals/${dId}`);
    loadDeals();
  };

  // ========== Activity handlers ==========
  const openCreateActivity = () => {
    setActivityForm({ type: 'call', subject: '', description: '', contactId: '', dealId: '', dueDate: '', completed: false });
    setActivityError('');
    setShowActivityModal(true);
  };

  const handleSubmitActivity = async (e: FormEvent) => {
    e.preventDefault();
    setActivityError('');
    try {
      const data = {
        companyId, type: activityForm.type, subject: activityForm.subject,
        description: activityForm.description || null,
        contactId: activityForm.contactId ? parseInt(activityForm.contactId) : null,
        dealId: activityForm.dealId ? parseInt(activityForm.dealId) : null,
        dueDate: activityForm.dueDate || null,
        completed: activityForm.completed,
      };
      await api.post('/crm/activities', data);
      setShowActivityModal(false);
      loadActivities();
    } catch (err: any) {
      setActivityError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const toggleActivityCompleted = async (a: Activity) => {
    await api.put(`/crm/activities/${a.id}`, { ...a, completed: !a.completed });
    loadActivities();
  };

  const handleDeleteActivity = async (aId: number) => {
    if (!confirm('この活動を削除しますか？')) return;
    await api.delete(`/crm/activities/${aId}`);
    loadActivities();
  };

  // ========== Association handlers ==========
  const handleAssignAssociation = async (associationId: number) => {
    try {
      await api.post(`/admin/companies/${id}/associations/${associationId}`, {});
      loadCompany();
    } catch (err: any) {
      alert(err.response?.data?.error || '協会の割り当てに失敗しました');
    }
  };

  const handleRemoveAssociation = async (associationId: number) => {
    if (!confirm('この協会の割り当てを削除しますか？')) return;
    try {
      await api.delete(`/admin/companies/${id}/associations/${associationId}`);
      loadCompany();
    } catch (err: any) {
      alert(err.response?.data?.error || '協会の削除に失敗しました');
    }
  };

  if (!company) return <div className="text-center py-8 text-gray-500">読み込み中...</div>;

  const tabs = [
    { key: 'overview' as const, label: '概要', count: undefined },
    { key: 'contacts' as const, label: '連絡先', count: contacts.length },
    { key: 'deals' as const, label: '商談', count: deals.length },
    { key: 'activities' as const, label: '活動履歴', count: activities.length },
    { key: 'wiki' as const, label: 'Wiki', count: company._count?.wikiPages || 0 },
    { key: 'comments' as const, label: 'コメント', count: company._count?.comments || 0 },
    { key: 'projects' as const, label: 'プロジェクト', count: company.projects?.length || 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mt-2">{company.name}</h1>
      </div>


      {/* Tabs */}
      <div className="border-b mb-4">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === tab.key ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label} {tab.count !== undefined && <span className="text-xs text-gray-400 ml-1">({tab.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-700">連絡先</h2>
            <button onClick={openCreateContact} className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">新規連絡先</button>
          </div>
          <div className="bg-white rounded-lg shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">所属</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">役職</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">電話</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        {c.lastName} {c.firstName}
                        <button
                          onClick={() => setCommentContact(c)}
                          title="コメント"
                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-sky-100 ${(c._count?.comments ?? 0) > 0 ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          <MessageSquare className="w-3 h-3" />
                          {(c._count?.comments ?? 0) > 0 && c._count!.comments}
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.details && c.details.filter(d => d.isPrimary).length > 0 ? (
                        <div className="space-y-1">
                          {c.details.filter(d => d.isPrimary).map((d, i) => (
                            <div key={i} className="text-xs">{d.department || '-'}</div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.details && c.details.filter(d => d.isPrimary).length > 0 ? (
                        <div className="space-y-1">
                          {c.details.filter(d => d.isPrimary).map((d, i) => (
                            <div key={i} className="text-xs">{d.position || '-'}</div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.details && c.details.filter(d => d.isPrimary).length > 0 ? (
                        <div className="space-y-1">
                          {c.details.filter(d => d.isPrimary).map((d, i) => (
                            <div key={i} className="text-xs">{d.phone || '-'}</div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.details && c.details.filter(d => d.isPrimary).length > 0 ? (
                        <div className="space-y-1">
                          {c.details.filter(d => d.isPrimary).map((d, i) => (
                            <div key={i} className="text-xs">
                              {d.email ? <a href={`mailto:${d.email}`} className="text-sky-600 hover:underline">{d.email}</a> : '-'}
                            </div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditContact(c)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteContact(c.id)} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contacts.length === 0 && <div className="text-center py-8 text-gray-500">連絡先が登録されていません</div>}
          </div>
        </div>
      )}

      {/* Deals Tab */}
      {activeTab === 'deals' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-700">商談</h2>
            <button onClick={openCreateDeal} className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">新規商談</button>
          </div>
          <div className="bg-white rounded-lg shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">商談名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">金額</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">確度</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">予定日</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">担当者</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">連絡先</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                    <td className="px-4 py-3">{getDealStatusBadge(d.status)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{d.amount != null ? `¥${d.amount.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{d.probability != null ? `${d.probability}%` : '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString('ja-JP') : '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.assignedTo ? `${d.assignedTo.lastName} ${d.assignedTo.firstName}` : '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.contact ? `${d.contact.lastName} ${d.contact.firstName}` : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditDeal(d)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteDeal(d.id)} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deals.length === 0 && <div className="text-center py-8 text-gray-500">商談が登録されていません</div>}
          </div>
          {deals.length > 0 && (
            <div className="mt-4 flex gap-4 text-sm text-gray-600">
              <span>合計金額: <strong>¥{deals.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}</strong></span>
              <span>成約: <strong>{deals.filter((d) => d.status === 'closed_won').length}件</strong></span>
              <span>進行中: <strong>{deals.filter((d) => !d.status.startsWith('closed')).length}件</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Activities Tab */}
      {
        activeTab === 'activities' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-700">活動履歴</h2>
              <button onClick={openCreateActivity} className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">新規活動</button>
            </div>
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className={`bg-white rounded-lg shadow px-4 py-3 flex items-start gap-3 ${a.completed ? 'opacity-60' : ''}`}>
                  <span className="text-xl mt-0.5">{getActivityIcon(a.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${a.completed ? 'line-through text-gray-400' : 'text-slate-800'}`}>{a.subject}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{getActivityLabel(a.type)}</span>
                      {a.contact && <span className="text-xs text-gray-500">→ {a.contact.lastName} {a.contact.firstName}</span>}
                      {a.deal && <span className="text-xs text-indigo-500">📊 {a.deal.name}</span>}
                    </div>
                    {a.description && <p className="text-sm text-gray-600 mt-1">{a.description}</p>}
                    <div className="text-xs text-gray-400 mt-1">
                      {a.user.lastName} {a.user.firstName} · {new Date(a.createdAt).toLocaleString('ja-JP')}
                      {a.dueDate && <span className="ml-2">期限: {new Date(a.dueDate).toLocaleDateString('ja-JP')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActivityCompleted(a)}
                      className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${a.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-sky-500'}`}>
                      {a.completed && '✓'}
                    </button>
                    <button onClick={() => handleDeleteActivity(a.id)} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {activities.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">活動が登録されていません</div>}
            </div>
          </div>
        )
      }

      {/* Overview Tab */}
      {
        activeTab === 'overview' && (
          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-700">基本情報</h2>
                <div className="flex gap-2">
                  <button onClick={() => setShowCompanyModal(true)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={handleDeleteCompany} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow px-6 py-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">住所</div>
                    <div className="text-slate-800 font-medium whitespace-pre-wrap">
                      {company.postalCode && `〒${company.postalCode} `}
                      {company.prefecture}{company.city}{company.street}{company.building}
                      {!company.postalCode && !company.prefecture && !company.city && !company.street && !company.building && '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">電話番号</div>
                    <div className="text-slate-800 font-medium">{company.phone || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">ウェブサイト</div>
                    <div className="text-slate-800 font-medium">
                      {company.website ? (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                          {company.website}
                        </a>
                      ) : (
                        '-'
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <div className="text-gray-500 mb-1">備考</div>
                    <div className="text-slate-800 whitespace-pre-wrap">{company.notes || '-'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-700">協会の割り当て</h2>
                <button
                  onClick={() => setShowAddAssociationModal(true)}
                  className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm transition-colors"
                >
                  追加
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">協会名</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">住所</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">電話</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">ウェブサイト</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedAssociations.map((ca) => (
                    <tr key={ca.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{ca.association.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {ca.association.postalCode && `〒${ca.association.postalCode} `}
                        {ca.association.prefecture}{ca.association.city}{ca.association.street}{ca.association.building}
                        {!ca.association.postalCode && !ca.association.prefecture && !ca.association.city && !ca.association.street && !ca.association.building && '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{ca.association.phone || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {ca.association.website ? (
                          <a href={ca.association.website} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                            {ca.association.website}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleRemoveAssociation(ca.association.id)} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {assignedAssociations.length === 0 && <div className="text-center py-8 text-gray-500">協会が割り当てられていません</div>}
            </div>
          </div>
        )
      }

      {/* Projects Tab */}
      {
        activeTab === 'projects' && (
          <div>
            <h2 className="text-lg font-semibold text-slate-700 mb-4">関連プロジェクト</h2>
            <div className="space-y-2">
              {company.projects && company.projects.length > 0 ? company.projects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block bg-white rounded-lg shadow px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-800">{p.name}</span>
                      <span className="text-gray-400 text-sm ml-2">{p.identifier}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {p.status === 'active' ? '有効' : '終了'}
                    </span>
                  </div>
                </Link>
              )) : <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">関連プロジェクトがありません</div>}
            </div>
          </div>
        )
      }

      {/* Wiki Tab */}
      {
        activeTab === 'wiki' && (
          <CompanyWikiTab companyId={companyId} />
        )
      }

      {/* Comments Tab */}
      {
        activeTab === 'comments' && (
          <CompanyCommentsTab companyId={companyId} />
        )
      }

      {/* Contact Comments Modal */}
      <Modal
        isOpen={commentContact !== null}
        onClose={() => setCommentContact(null)}
        title={commentContact ? `${commentContact.lastName} ${commentContact.firstName} のコメント` : ''}
      >
        {commentContact && (
          <ContactCommentsSection contactId={commentContact.id} />
        )}
      </Modal>

      {/* Contact Modal */}
      <Modal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title={editingContact ? '連絡先編集' : '連絡先登録'}
      >
        {contactError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{contactError}</div>}
        <form onSubmit={handleSubmitContact}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓 *</label>
              <input type="text" value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} required
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名 *</label>
              <input type="text" value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} required
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">連絡先詳細 (複数設定可)</label>
              <button type="button" onClick={() => setContactDetails([...contactDetails, { department: '', position: '', phone: '', email: '', isPrimary: false }])}
                className="text-sky-600 hover:text-sky-800 text-xs font-medium">+ 追加</button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {contactDetails.map((detail, index) => (
                <div key={index} className="border rounded-md p-3 bg-gray-50 relative">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">所属</label>
                      <input type="text" value={detail.department} placeholder="例: 営業部"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], department: e.target.value };
                          setContactDetails(newDetails);
                        }}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">役職</label>
                      <input type="text" value={detail.position} placeholder="例: 部長"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], position: e.target.value };
                          setContactDetails(newDetails);
                        }}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">電話</label>
                      <input type="text" value={detail.phone} placeholder="例: 03-0000-0000"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], phone: e.target.value };
                          setContactDetails(newDetails);
                        }}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">メール</label>
                      <input type="email" value={detail.email} placeholder="例: name@example.com"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], email: e.target.value };
                          setContactDetails(newDetails);
                        }}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                      <input type="checkbox" checked={detail.isPrimary}
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], isPrimary: e.target.checked };
                          setContactDetails(newDetails);
                        }}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                      代表連絡先として表示
                    </label>
                    {contactDetails.length > 1 && (
                      <button type="button" onClick={() => setContactDetails(contactDetails.filter((_, i) => i !== index))}
                        className="text-xs text-red-500 hover:text-red-700">削除</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={2}
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowContactModal(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">{editingContact ? '更新' : '作成'}</button>
          </div>
        </form>
      </Modal>

      {/* Deal Modal */}
      <Modal
        isOpen={showDealModal}
        onClose={() => setShowDealModal(false)}
        title={editingDeal ? '商談編集' : '商談登録'}
      >
        {dealError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{dealError}</div>}
        <form onSubmit={handleSubmitDeal}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">商談名 *</label>
            <input type="text" value={dealForm.name} onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} required
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
              <input type="number" value={dealForm.amount} onChange={(e) => setDealForm({ ...dealForm, amount: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="¥" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">確度 (%)</label>
              <input type="number" min="0" max="100" value={dealForm.probability} onChange={(e) => setDealForm({ ...dealForm, probability: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
              <select value={dealForm.status} onChange={(e) => setDealForm({ ...dealForm, status: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                {DEAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">予定クローズ日</label>
              <input type="date" value={dealForm.expectedCloseDate} onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">連絡先</label>
              <select value={dealForm.contactId} onChange={(e) => setDealForm({ ...dealForm, contactId: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">選択なし</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.lastName} {c.firstName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
              <select value={dealForm.assignedToId} onChange={(e) => setDealForm({ ...dealForm, assignedToId: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">選択なし</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.lastName} {u.firstName}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} rows={2}
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowDealModal(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">{editingDeal ? '更新' : '作成'}</button>
          </div>
        </form>
      </Modal>

      {/* Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="活動登録"
      >
        <form onSubmit={handleSubmitActivity}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">種類 *</label>
              <select value={activityForm.type} onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">期限日</label>
              <input type="date" value={activityForm.dueDate} onChange={(e) => setActivityForm({ ...activityForm, dueDate: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">件名 *</label>
            <input type="text" value={activityForm.subject} onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })} required
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">詳細</label>
            <textarea value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} rows={3}
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">連絡先</label>
              <select value={activityForm.contactId} onChange={(e) => setActivityForm({ ...activityForm, contactId: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">選択なし</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.lastName} {c.firstName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商談</label>
              <select value={activityForm.dealId} onChange={(e) => setActivityForm({ ...activityForm, dealId: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">選択なし</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowActivityModal(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">作成</button>
          </div>
        </form>
      </Modal>
      {/* Add Association Modal */}
      <Modal
        isOpen={showAddAssociationModal}
        onClose={() => setShowAddAssociationModal(false)}
        title="協会を割り当て"
      >
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">協会</label>
          <select
            value={newAssociationId}
            onChange={(e) => setNewAssociationId(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
          >
            <option value="">-- 協会を選択 --</option>
            {masterAssociations
              .filter((ma) => !assignedAssociations.some((aa) => aa.association.id === ma.id))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAddAssociationModal(false);
              setNewAssociationId('');
            }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => {
              if (newAssociationId) {
                handleAssignAssociation(parseInt(newAssociationId));
                setShowAddAssociationModal(false);
                setNewAssociationId('');
              }
            }}
            disabled={!newAssociationId}
            className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            追加
          </button>
        </div>
      </Modal>

      <CompanyModal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        onSuccess={loadCompany}
        editingCompany={company}
      />
    </div>
  );
}
