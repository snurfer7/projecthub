import { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Company, Contact, Deal, Activity, Association } from '../types';
import { formatCompanyName, formatContactDisplayName } from '../utils/format';
import { Pencil, Trash2, MessageSquare, GitMerge } from 'lucide-react';
import CompanyModal from '../components/CompanyModal';
import Modal from '../components/Modal';
import CompanyWikiTab from '../components/CompanyWikiTab';
import CompanyCommentsTab from '../components/CompanyCommentsTab';
import ContactCommentsSection from '../components/ContactCommentsSection';
import CompanyLocationsTab from '../components/CompanyLocationsTab';
import ConfirmationModal, { ConfirmationConfirmExtra } from '../components/ConfirmationModal';
import Combobox from '../components/Combobox';
import TextInput from '../components/TextInput';
import NumberInput from '../components/NumberInput';
import DateInput from '../components/DateInput';
import Tabs from '../components/Tabs';
import { Project } from '../types';


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
  { value: 'lead', label: '引合', icon: '🤝' },
  { value: 'estimate', label: '見積り', icon: '📋' },
  { value: 'inquiry', label: '問合せ', icon: '❓' },
  { value: 'maintenance', label: 'メンテ', icon: '🔧' },
  { value: 'claim', label: 'クレーム', icon: '⚠️' },
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
  const activeTab = (query.get('tab') || 'overview') as 'overview' | 'contacts' | 'deals' | 'activities' | 'projects' | 'wiki' | 'comments' | 'locations';

  const parseQueryInt = (key: string): number | null => {
    const v = query.get(key);
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const highlightActivityId = parseQueryInt('activity');
  const highlightCommentId = parseQueryInt('comment');

  const setActiveTab = (tab: string) => {
    navigate(`?tab=${tab}`, { replace: true });
  };

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', notes: '' });
  const [contactDetails, setContactDetails] = useState<{ department: string; position: string; phone: string; email: string; locationId: string; isPrimary: boolean }[]>([]);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [contactError, setContactError] = useState('');
  const [commentContact, setCommentContact] = useState<Contact | null>(null);

  // Deals
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealForm, setDealForm] = useState({ name: '', amount: '', status: 'prospecting', probability: '', expectedCloseDate: '', contactId: '', assignedToId: '', notes: '' });
  const [dealError, setDealError] = useState('');
  const [users, setUsers] = useState<{ id: number; firstName: string; lastName: string; status: string }[]>([]);

  // Company Edit
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  // Merge company into another
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | number>('');
  const [mergeCandidates, setMergeCandidates] = useState<Company[]>([]);
  const [mergeModalLoading, setMergeModalLoading] = useState(false);
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [mergeError, setMergeError] = useState('');

  // Activities
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({ type: 'call', subject: '', description: '', contactId: '', dealId: '', assignedToId: '', dueDate: '', completed: false });
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [activityError, setActivityError] = useState('');
  const activityHighlightRef = useRef<HTMLDivElement | null>(null);

  // Associations
  const [masterAssociations, setMasterAssociations] = useState<Association[]>([]);
  const [assignedAssociations, setAssignedAssociations] = useState<{ id: number; association: Association }[]>([]);
  const [showAddAssociationModal, setShowAddAssociationModal] = useState(false);
  const [newAssociationId, setNewAssociationId] = useState('');

  // 削除用ステート（活動でファイル用コメントがあるとき fileCommentId を持つ）
  const [confirmDelete, setConfirmDelete] = useState<{
    type: string;
    id: number;
    name: string;
    fileCommentId?: number | null;
  } | null>(null);

  const companyId = Number(id);


  const loadCompany = () => api.get(`/companies/${id}`).then((res) => {
    setCompany(res.data);
    setAssignedAssociations(res.data.associations || []);
  });
  const loadContacts = () => api.get(`/crm/contacts?companyId=${id}`).then((res) => setContacts(res.data));
  const loadDeals = () => api.get(`/crm/deals?companyId=${id}`).then((res) => setDeals(res.data));
  const loadActivities = () => api.get(`/crm/activities?companyId=${id}`).then((res) => setActivities(res.data));
  const loadMasterAssociations = () => api.get('/admin/associations').then((res) => setMasterAssociations(res.data));
  const loadUsers = () => api.get('/admin/users').then((res) => setUsers(res.data.map((u: { id: number; firstName: string; lastName: string; status: string }) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, status: u.status }))));
  const loadLocations = () => api.get(`/companies/${id}/locations`).then((res) => setLocations(res.data));

  useEffect(() => {
    loadCompany();
    loadContacts();
    loadDeals();
    loadActivities();
    loadMasterAssociations();
    loadUsers();
    loadLocations();
  }, [id]);

  useEffect(() => {
    if (activeTab !== 'activities' || highlightActivityId == null || !activityHighlightRef.current) return;
    const el = activityHighlightRef.current;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.classList.add('ring-2', 'ring-sky-400');
    const t = window.setTimeout(() => el.classList.remove('ring-2', 'ring-sky-400'), 4000);
    return () => window.clearTimeout(t);
  }, [activeTab, highlightActivityId, activities]);

  const handleDeleteCompany = async () => {
    try {
      await api.delete(`/companies/${id}`);
      setConfirmDelete(null);
      navigate('/companies');
    } catch (err: any) {
      alert(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const openMergeModal = () => {
    setMergeError('');
    setMergeTargetId('');
    setShowMergeModal(true);
    setMergeModalLoading(true);
    api
      .get<Company[]>('/companies')
      .then((res) => {
        setMergeCandidates(res.data.filter((c) => c.id !== companyId));
      })
      .catch(() => {
        setMergeError('企業一覧の取得に失敗しました');
        setMergeCandidates([]);
      })
      .finally(() => setMergeModalLoading(false));
  };

  const handleMergeCompanies = async () => {
    if (mergeTargetId === '' || mergeTargetId == null) {
      setMergeError('統合先の企業を選択してください');
      return;
    }
    const tid = Number(mergeTargetId);
    if (!Number.isFinite(tid)) {
      setMergeError('統合先の企業を選択してください');
      return;
    }
    setMergeSubmitting(true);
    setMergeError('');
    try {
      await api.post(`/companies/${companyId}/merge`, { targetCompanyId: tid });
      setShowMergeModal(false);
      navigate(`/companies/${tid}?tab=overview`);
    } catch (err: any) {
      setMergeError(err.response?.data?.error || '統合に失敗しました');
    } finally {
      setMergeSubmitting(false);
    }
  };

  // ========== Contact handlers ==========
  const openCreateContact = () => {
    setEditingContact(null);
    setContactForm({ firstName: '', lastName: '', notes: '' });
    setContactDetails([{ department: '', position: '', phone: '', email: '', locationId: '', isPrimary: true }]);
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
      locationId: d.locationId?.toString() || '',
      isPrimary: d.isPrimary || false
    })) : [{ department: '', position: '', phone: '', email: '', locationId: '', isPrimary: true }]);
    setContactError('');
    setShowContactModal(true);
  };

  const handleSubmitContact = async (e: FormEvent) => {
    e.preventDefault();
    setContactError('');
    try {
      const data = {
        ...contactForm,
        firstName: contactForm.firstName.trim(),
        lastName: contactForm.lastName.trim(),
        companyId,
        notes: contactForm.notes || null,
        details: contactDetails.filter(d => d.department || d.position || d.phone || d.email || d.locationId).map(d => ({
          ...d,
          locationId: d.locationId ? parseInt(d.locationId) : null,
        })),
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
    await api.delete(`/crm/contacts/${cId}`);
    setConfirmDelete(null);
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
    await api.delete(`/crm/deals/${dId}`);
    setConfirmDelete(null);
    loadDeals();
  };

  // ========== Activity handlers ==========
  const openCreateActivity = () => {
    setEditingActivity(null);
    setActivityForm({ type: 'call', subject: '', description: '', contactId: '', dealId: '', assignedToId: '', dueDate: '', completed: false });
    setActivityFiles([]);
    setActivityError('');
    setShowActivityModal(true);
  };

  const openEditActivity = (a: Activity) => {
    setEditingActivity(a);
    setActivityForm({
      type: a.type,
      subject: a.subject,
      description: a.description || '',
      contactId: a.contactId?.toString() || '',
      dealId: a.dealId?.toString() || '',
      assignedToId: a.assignedToId?.toString() || '',
      dueDate: a.dueDate?.split('T')[0] || '',
      completed: a.completed,
    });
    setActivityFiles([]);
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
        assignedToId: activityForm.assignedToId ? parseInt(activityForm.assignedToId) : null,
        dueDate: activityForm.dueDate || null,
        completed: activityForm.completed,
      };
      let saved: Activity;
      if (editingActivity) {
        const res = await api.put(`/crm/activities/${editingActivity.id}`, data);
        saved = res.data;
      } else {
        const res = await api.post('/crm/activities', data);
        saved = res.data;
      }

      let fileCommentId = saved.fileCommentId ?? null;
      if (activityFiles.length > 0) {
        if (!fileCommentId) {
          const cr = await api.post(`/companies/${companyId}/comments`, { sourceActivityId: saved.id });
          fileCommentId = cr.data.id;
        }
        for (const file of activityFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('companyCommentId', String(fileCommentId));
          await api.post('/attachments/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      setShowActivityModal(false);
      setActivityFiles([]);
      loadActivities();
      loadCompany();
    } catch (err: any) {
      setActivityError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const toggleActivityCompleted = async (a: Activity) => {
    await api.put(`/crm/activities/${a.id}`, {
      contactId: a.contactId,
      dealId: a.dealId,
      assignedToId: a.assignedToId,
      type: a.type,
      subject: a.subject,
      description: a.description ?? null,
      dueDate: a.dueDate,
      completed: !a.completed,
    });
    loadActivities();
  };

  const downloadActivityAttachment = async (attachmentId: number) => {
    try {
      const res = await api.post(`/attachments/token/${attachmentId}`);
      const { token } = res.data;
      window.open(`/api/attachments/file/${attachmentId}?downloadToken=${token}`, '_blank');
    } catch {
      alert('ダウンロードに失敗しました');
    }
  };

  const handleDeleteActivityAttachment = async (attachmentId: number) => {
    if (!window.confirm('このファイルを削除しますか？コメントの添付一覧からも消えます。')) return;
    try {
      await api.delete(`/attachments/${attachmentId}`);
      setEditingActivity((prev) => {
        if (!prev?.fileComment) return prev;
        const attachments = (prev.fileComment.attachments || []).filter((x) => x.id !== attachmentId);
        return { ...prev, fileComment: { ...prev.fileComment, attachments } };
      });
      loadActivities();
    } catch (err: any) {
      alert(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const handleDeleteActivity = async (aId: number, deleteLinkedCompanyComment?: boolean) => {
    try {
      const params: Record<string, string> = {};
      if (deleteLinkedCompanyComment === true) {
        params.deleteLinkedComment = 'true';
      } else if (deleteLinkedCompanyComment === false) {
        params.deleteLinkedComment = 'false';
      }
      await api.delete(`/crm/activities/${aId}`, {
        params: Object.keys(params).length ? params : undefined,
      });
      setConfirmDelete(null);
      loadActivities();
      loadCompany();
    } catch (err: any) {
      alert(err.response?.data?.error || '削除に失敗しました');
    }
  };

  // ========== Association handlers ==========
  const handleAssignAssociation = async (associationId: number) => {
    try {
      await api.post(`/companies/${id}/associations/${associationId}`, {});
      loadCompany();
    } catch (err: any) {
      alert(err.response?.data?.error || '協会の割り当てに失敗しました');
    }
  };

  const handleRemoveAssociation = async (associationId: number) => {
    try {
      await api.delete(`/companies/${id}/associations/${associationId}`);
      setConfirmDelete(null);
      loadCompany();
    } catch (err: any) {
      alert(err.response?.data?.error || '協会の削除に失敗しました');
    }
  };

  if (!company) return <div className="text-center py-8 text-gray-500">読み込み中...</div>;

  const tabs = [
    { key: 'overview', label: '概要', count: undefined },
    { key: 'contacts', label: '連絡先', count: contacts.length },
    { key: 'deals', label: '商談', count: deals.length },
    { key: 'activities', label: '活動履歴', count: activities.length },
    { key: 'wiki', label: 'Wiki', count: company._count?.wikiPages || 0 },
    { key: 'comments', label: 'コメント', count: company._count?.comments || 0 },
    { key: 'locations', label: '拠点', count: company._count?.locations || 0 },
    { key: 'projects', label: 'プロジェクト', count: company.projects?.length || 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mt-2">{formatCompanyName(company)}</h1>
      </div>


      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">拠点</th>
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
                        {formatContactDisplayName(c.lastName, c.firstName)}
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
                            <div key={i} className="text-xs">{d.location?.name || '-'}</div>
                          ))}
                        </div>
                      ) : '-'}
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
                        <button onClick={() => setConfirmDelete({ type: 'contact', id: c.id, name: formatContactDisplayName(c.lastName, c.firstName) })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">自社担当者</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">先方担当者</th>
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
                    <td className="px-4 py-3 text-gray-600">{d.contact ? formatContactDisplayName(d.contact.lastName, d.contact.firstName) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditDeal(d)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmDelete({ type: 'deal', id: d.id, name: d.name })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
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
                <div
                  key={a.id}
                  id={`activity-card-${a.id}`}
                  ref={highlightActivityId === a.id ? activityHighlightRef : undefined}
                  className={`bg-white rounded-lg shadow px-4 py-3 flex items-start gap-3 ${a.completed ? 'opacity-60' : ''}`}
                >
                  <span className="text-xl mt-0.5">{getActivityIcon(a.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${a.completed ? 'line-through text-gray-400' : 'text-slate-800'}`}>{a.subject}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{getActivityLabel(a.type)}</span>
                      {a.deal && <span className="text-xs text-indigo-500">📊 {a.deal.name}</span>}
                    </div>
                    {a.description && <p className="text-sm text-gray-600 mt-1">{a.description}</p>}
                    {a.fileComment && a.fileComment.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="text-gray-500 shrink-0">添付:</span>
                        {a.fileComment.attachments.map((att) => (
                          <button
                            key={att.id}
                            type="button"
                            onClick={() => downloadActivityAttachment(att.id)}
                            className="text-sky-600 hover:underline font-medium truncate max-w-[220px] text-left"
                            title={att.filename}
                          >
                            {att.filename}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      自社担当: {a.assignedTo ? `${a.assignedTo.lastName} ${a.assignedTo.firstName}` : '-'}
                      {a.contact && <span> · 先方: {formatContactDisplayName(a.contact.lastName, a.contact.firstName)}</span>}
                      <span> · 登録: {a.user.lastName} {a.user.firstName} · {new Date(a.createdAt).toLocaleString('ja-JP')}</span>
                      {a.dueDate && <span className="ml-2">期限: {new Date(a.dueDate).toLocaleDateString('ja-JP')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActivityCompleted(a)}
                      className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${a.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-sky-500'}`}>
                      {a.completed && '✓'}
                    </button>
                    <button onClick={() => openEditActivity(a)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDelete({
                          type: 'activity',
                          id: a.id,
                          name: a.subject,
                          ...(a.fileCommentId != null ? { fileCommentId: a.fileCommentId } : {}),
                        })
                      }
                      title="削除"
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
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
                  <button type="button" onClick={openMergeModal} title="統合先の企業へデータを移す" className="p-1.5 text-violet-600 hover:bg-violet-50 rounded">
                    <GitMerge className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowCompanyModal(true)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDelete({ type: 'company', id: companyId, name: company.name })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow px-6 py-5 text-sm">
                <div className="space-y-6">
                  {(() => {
                    const profileLocations = company.locations?.filter(loc => loc.isProfileDisplay) || [];
                    if (profileLocations.length === 0) {
                      return <div className="text-gray-500 text-center py-4">表示設定されている拠点がありません</div>;
                    }
                    return profileLocations.map((loc, idx) => (
                      <div key={loc.id} className={`${idx > 0 ? 'border-t border-gray-100 pt-6' : ''}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
                          <h3 className="font-semibold text-slate-800">{loc.name}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <div className="text-gray-500 mb-1 flex items-center gap-1.5">住所</div>
                            <div className="text-slate-600 font-medium whitespace-pre-wrap">
                              {loc.postalCode && `〒${loc.postalCode} `}
                              {loc.prefecture}{loc.city}{loc.street}{loc.building}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">電話番号</div>
                            <div className="text-slate-600 font-medium">{loc.phone || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">FAX</div>
                            <div className="text-slate-600 font-medium">{loc.fax || '-'}</div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}

                  <div className="border-t border-gray-100 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <div className="text-gray-500 mb-1">ウェブサイト</div>
                        <div className="text-slate-600 font-medium">
                          {company.website ? (
                            <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                              {company.website}
                            </a>
                          ) : (
                            '-'
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-3 mt-4">
                        <div className="text-gray-500 mb-1">備考</div>
                        <div className="text-slate-600 whitespace-pre-wrap leading-relaxed">{company.notes || '-'}</div>
                      </div>
                    </div>
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
                          <button onClick={() => setConfirmDelete({ type: 'association', id: ca.association.id, name: ca.association.name })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
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
          <CompanyCommentsTab companyId={companyId} highlightCommentId={highlightCommentId} />
        )
      }

      {/* Locations Tab */}
      {
        activeTab === 'locations' && (
          <CompanyLocationsTab companyId={companyId} onUpdateCount={loadCompany} />
        )
      }

      {/* Contact Comments Modal */}
      <Modal
        isOpen={commentContact !== null}
        onClose={() => setCommentContact(null)}
        title={commentContact ? `${formatContactDisplayName(commentContact.lastName, commentContact.firstName)} のコメント` : ''}
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
        footer={
          <>
            <button type="button" onClick={() => setShowContactModal(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" form="company-contact-form" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">{editingContact ? '更新' : '作成'}</button>
          </>
        }
      >
        {contactError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{contactError}</div>}
        <form id="company-contact-form" onSubmit={handleSubmitContact} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-0">
            <TextInput label="姓 *" required value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} />
            <TextInput label="名" value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} />
          </div>
          <div className="mb-0">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">連絡先詳細 (複数設定可)</label>
              <button type="button" onClick={() => setContactDetails([...contactDetails, { department: '', position: '', phone: '', email: '', locationId: '', isPrimary: false }])}
                className="text-sky-600 hover:text-sky-800 text-xs font-medium">+ 追加</button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {contactDetails.map((detail, index) => (
                <div key={index} className="border rounded-md p-3 bg-gray-50 relative">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2">
                      <Combobox
                        label="拠点"
                        value={detail.locationId}
                        options={(company?.locations ?? locations).map((loc) => ({ value: loc.id.toString(), label: loc.name }))}
                        onChange={(val) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], locationId: val };
                          setContactDetails(newDetails);
                        }}
                        size="small"
                      />
                    </div>
                    <div>
                      <TextInput label="所属" size="small" value={detail.department} placeholder="例: 営業部"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], department: e.target.value };
                          setContactDetails(newDetails);
                        }} />
                    </div>
                    <div>
                      <TextInput label="役職" size="small" value={detail.position} placeholder="例: 部長"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], position: e.target.value };
                          setContactDetails(newDetails);
                        }} />
                    </div>
                    <div>
                      <TextInput label="電話" size="small" value={detail.phone} placeholder="例: 03-0000-0000"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], phone: e.target.value };
                          setContactDetails(newDetails);
                        }} />
                    </div>
                    <div>
                      <TextInput type="email" label="メール" size="small" value={detail.email} placeholder="例: name@example.com"
                        onChange={(e) => {
                          const newDetails = [...contactDetails];
                          newDetails[index] = { ...newDetails[index], email: e.target.value };
                          setContactDetails(newDetails);
                        }} />
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
          <TextInput isMultiline label="備考" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={2} className="mb-0" />
        </form>
      </Modal>

      {/* Deal Modal */}
      <Modal
        isOpen={showDealModal}
        onClose={() => setShowDealModal(false)}
        title={editingDeal ? '商談編集' : '商談登録'}
        footer={
          <>
            <button type="button" onClick={() => setShowDealModal(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" form="company-deal-form" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">{editingDeal ? '更新' : '作成'}</button>
          </>
        }
      >
        {dealError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{dealError}</div>}
        <form id="company-deal-form" onSubmit={handleSubmitDeal} className="space-y-4">
          <TextInput label="商談名 *" required value={dealForm.name} onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} className="mb-0" />
          <div className="grid grid-cols-2 gap-4 mb-0">
            <NumberInput
              label="金額"
              value={dealForm.amount}
              onChange={(e) => setDealForm({ ...dealForm, amount: e.target.value })}
              startAdornment="¥"
              useCommaFormat
            />
            <NumberInput
              label="確度"
              min="0"
              max="100"
              value={dealForm.probability}
              onChange={(e) => setDealForm({ ...dealForm, probability: e.target.value })}
              endAdornment="%"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-0">
            <Combobox
              label="ステータス"
              value={dealForm.status}
              options={DEAL_STATUSES.map(s => ({ value: s.value, label: s.label }))}
              onChange={(val) => setDealForm({ ...dealForm, status: val })}
              className="mb-0"
            />
            <div>
              <DateInput
                label="予定クローズ日"
                id="expected-close-date"
                value={dealForm.expectedCloseDate}
                onChange={(val) => setDealForm({ ...dealForm, expectedCloseDate: val })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-0">
            <Combobox
              label="先方担当者"
              value={dealForm.contactId}
              options={contacts.map(c => ({ value: c.id.toString(), label: formatContactDisplayName(c.lastName, c.firstName) }))}
              onChange={(val) => setDealForm({ ...dealForm, contactId: val })}
            />
            <Combobox
              label="自社担当者"
              value={dealForm.assignedToId}
              options={users
                .filter(u => u.status === 'active' || dealForm.assignedToId === String(u.id))
                .map(u => ({ value: u.id.toString(), label: `${u.lastName} ${u.firstName}` }))}
              onChange={(val) => setDealForm({ ...dealForm, assignedToId: val })}
            />
          </div>
          <TextInput isMultiline label="備考" value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} rows={2} className="mb-0" />
        </form>
      </Modal>

      {/* Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title={editingActivity ? '活動履歴編集' : '活動履歴登録'}
        footer={
          <>
            <button type="button" onClick={() => setShowActivityModal(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm">キャンセル</button>
            <button type="submit" form="company-activity-form" className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">{editingActivity ? '更新' : '登録'}</button>
          </>
        }
      >
        {activityError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{activityError}</div>}
        <form id="company-activity-form" onSubmit={handleSubmitActivity} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-0">
            <Combobox
              label="種類"
              value={activityForm.type}
              options={ACTIVITY_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
              onChange={(val) => setActivityForm({ ...activityForm, type: val })}
            />
            <div>
              <DateInput
                label="期限日"
                id="activity-due-date"
                value={activityForm.dueDate}
                onChange={(val) => setActivityForm({ ...activityForm, dueDate: val })}
              />
            </div>
          </div>
          <TextInput label="件名 *" required value={activityForm.subject} onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })} className="mb-0" />
          <TextInput isMultiline label="詳細" value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} rows={3} className="mb-0" />
          <div className="grid grid-cols-2 gap-4 mb-0">
            <Combobox
              label="先方担当者"
              value={activityForm.contactId}
              options={contacts.map(c => ({ value: c.id.toString(), label: formatContactDisplayName(c.lastName, c.firstName) }))}
              onChange={(val) => setActivityForm({ ...activityForm, contactId: val })}
            />
            <Combobox
              label="商談"
              value={activityForm.dealId}
              options={deals.map(d => ({ value: d.id.toString(), label: d.name }))}
              onChange={(val) => setActivityForm({ ...activityForm, dealId: val })}
            />
          </div>
          <Combobox
            label="自社担当者"
            value={activityForm.assignedToId}
            options={users
              .filter(u => u.status === 'active' || activityForm.assignedToId === String(u.id))
              .map(u => ({ value: u.id.toString(), label: `${u.lastName} ${u.firstName}` }))}
            onChange={(val) => setActivityForm({ ...activityForm, assignedToId: val })}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activity-completed"
              checked={activityForm.completed}
              onChange={(e) => setActivityForm({ ...activityForm, completed: e.target.checked })}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="activity-completed" className="text-sm font-medium text-gray-700">完了としてマーク</label>
          </div>
          <div>
            <label htmlFor="activity-files" className="block text-sm font-medium text-gray-700 mb-1">ファイル添付</label>
            <p className="text-xs text-gray-500 mb-2">
              保存時に会社コメントへ紐づけて保存されます。一覧・ここからダウンロードできます。削除するとコメント側の添付からも消えます。
            </p>
            {editingActivity?.fileComment && editingActivity.fileComment.attachments.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {editingActivity.fileComment.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => downloadActivityAttachment(att.id)}
                      className="min-w-0 truncate text-left text-sky-600 hover:underline font-medium"
                      title={att.filename}
                    >
                      {att.filename}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteActivityAttachment(att.id)}
                      className="shrink-0 p-1 text-gray-400 hover:text-red-600 rounded"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              id="activity-files"
              type="file"
              multiple
              className="block w-full text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
              onChange={(e) => setActivityFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            {activityFiles.length > 0 && (
              <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                {activityFiles.map((f) => (
                  <li key={f.name + f.size}>追加予定: {f.name}</li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </Modal>
      {/* Add Association Modal */}
      <Modal
        isOpen={showAddAssociationModal}
        onClose={() => setShowAddAssociationModal(false)}
        title="協会を割り当て"
        footer={
          <>
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
          </>
        }
      >
        <Combobox
          label="協会"
          value={newAssociationId}
          options={masterAssociations.filter((ma) => !assignedAssociations.some((aa) => aa.association.id === ma.id)).map((a) => ({ value: a.id.toString(), label: a.name }))}
          onChange={(val) => setNewAssociationId(val)}
        />
      </Modal>

      <Modal
        isOpen={showMergeModal}
        onClose={() => {
          setShowMergeModal(false);
          setMergeError('');
          setMergeTargetId('');
        }}
        title="企業を統合"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowMergeModal(false);
                setMergeError('');
                setMergeTargetId('');
              }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => void handleMergeCompanies()}
              disabled={mergeModalLoading || mergeCandidates.length === 0 || mergeSubmitting}
              className="bg-violet-600 text-white px-4 py-2 rounded-md hover:bg-violet-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {mergeSubmitting ? '実行中…' : '統合を実行'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 mb-4">
          表示中の企業（統合元）に紐づく拠点・連絡先・商談・活動・コメント・Wiki・プロジェクト等の企業 ID を、選択した企業（統合先）に付け替えます。統合元の企業レコードは削除されます。この操作は取り消せません。
        </p>
        {mergeModalLoading ? (
          <div className="text-sm text-gray-500 py-4">読み込み中…</div>
        ) : mergeCandidates.length === 0 ? (
          <div className="text-sm text-amber-700 py-2">統合できる他の企業がありません。</div>
        ) : (
          <Combobox
            label="統合先の企業"
            value={mergeTargetId}
            onChange={(v) => setMergeTargetId(v)}
            options={mergeCandidates.map((c) => ({
              value: c.id,
              label: formatCompanyName(c),
            }))}
            placeholder="企業を選択"
          />
        )}
        {mergeError && <p className="text-sm text-red-600 mt-3">{mergeError}</p>}
      </Modal>

      <CompanyModal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        onSuccess={loadCompany}
        editingCompany={company}
      />

      <ConfirmationModal
        isOpen={!!confirmDelete}
        title={
          confirmDelete?.type === 'company' ? '企業の削除' :
            confirmDelete?.type === 'contact' ? '連絡先の削除' :
              confirmDelete?.type === 'deal' ? '商談の削除' :
                confirmDelete?.type === 'activity' ? '活動の削除' :
                  confirmDelete?.type === 'association' ? '協会の削除' : '削除の確認'
        }
        message={`${confirmDelete?.name} を削除しますか？この操作は取り消せません。`}
        linkedCommentDeleteCheckbox={
          confirmDelete?.type === 'activity' && confirmDelete.fileCommentId != null
            ? {
                label: '紐づくファイル用コメントと添付ファイルも削除する',
                defaultChecked: true,
              }
            : undefined
        }
        onConfirm={(extra?: ConfirmationConfirmExtra) => {
          if (!confirmDelete) return;
          switch (confirmDelete.type) {
            case 'company': handleDeleteCompany(); break;
            case 'contact': handleDeleteContact(confirmDelete.id); break;
            case 'deal': handleDeleteDeal(confirmDelete.id); break;
            case 'activity':
              handleDeleteActivity(
                confirmDelete.id,
                confirmDelete.fileCommentId != null
                  ? extra?.deleteLinkedCompanyComment !== false
                  : undefined
              );
              break;
            case 'association': handleRemoveAssociation(confirmDelete.id); break;
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        variant="danger"
      />
    </div>

  );
}
