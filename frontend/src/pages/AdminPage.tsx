import { useState, useEffect, FormEvent, DragEvent } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api/client';
import { User, Tracker, IssueStatus, IssuePriority, Group, Role, SystemSetting } from '../types';
import { Pencil, Trash2, GripVertical, Clock, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import AnalogTimePicker from '../components/AnalogTimePicker';
import CustomTimePicker from '../components/CustomTimePicker';
import ConfirmationModal from '../components/ConfirmationModal';
import TextInput from '../components/TextInput';
import Combobox from '../components/Combobox';
import NumberInput from '../components/NumberInput';
import Tabs from '../components/Tabs';


interface Props {
  user: User;
}

export default function AdminPage({ user }: Props) {
  const [tab, setTab] = useState<'users' | 'groups' | 'roles' | 'trackers' | 'statuses' | 'priorities' | 'time'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [priorities, setPriorities] = useState<IssuePriority[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // User modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [userGroupIds, setUserGroupIds] = useState<number[]>([]);
  const [userError, setUserError] = useState('');

  // Master data modal states (roles, trackers, statuses, priorities)
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [masterType, setMasterType] = useState<'roles' | 'trackers' | 'statuses' | 'priorities' | null>(null);
  const [editingMasterId, setEditingMasterId] = useState<number | null>(null);
  const [masterName, setMasterName] = useState('');
  const [masterError, setMasterError] = useState('');
  const [masterStatusIds, setMasterStatusIds] = useState<number[]>([]);
  const [masterTransitions, setMasterTransitions] = useState<Set<string>>(new Set());
  const [masterIsDefaultRole, setMasterIsDefaultRole] = useState(false);

  // Group modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [groupError, setGroupError] = useState('');

  // Group detail states
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Association modal states (削除済み)

  // Time settings states
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [managementTimes, setManagementTimes] = useState<string[]>([]);
  const [conversionTimes, setConversionTimes] = useState<number[]>([0]);
  const [timeLoading, setTimeLoading] = useState(false);
  const [timeMessage, setTimeMessage] = useState('');
  const [timeError, setTimeError] = useState('');

  // 削除用ステート
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: number; name: string } | null>(null);

  if (user.role !== 'admin') return <Navigate to="/" />;

  const loadAll = () => {
    api.get('/admin/users').then((res) => {
      console.log('ユーザー取得:', res.data.length);
      setUsers(res.data);
    }).catch((e) => console.error('ユーザー取得失敗:', e));
    api.get('/admin/roles').then((res) => {
      console.log('ロール取得:', res.data.length);
      setRoles(res.data);
    }).catch((e) => console.error('ロール取得失敗:', e));
    api.get('/admin/trackers').then((res) => {
      console.log('トラッカー取得:', res.data.length);
      setTrackers(res.data);
    }).catch((e) => console.error('トラッカー取得失敗:', e));
    api.get('/admin/statuses').then((res) => {
      console.log('ステータス取得:', res.data.length);
      setStatuses(res.data);
    }).catch((e) => console.error('ステータス取得失敗:', e));
    api.get('/admin/priorities').then((res) => {
      console.log('優先度取得:', res.data.length);
      setPriorities(res.data);
    }).catch((e) => console.error('優先度取得失敗:', e));
    api.get('/admin/groups').then((res) => {
      console.log('グループ取得:', res.data.length);
      setGroups(res.data);
    }).catch((e) => console.error('グループ取得失敗:', e));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (tab === 'time') {
      fetchTimeSettings();
    }
  }, [tab]);

  const fetchTimeSettings = async () => {
    try {
      setTimeLoading(true);
      const res = await api.get('/admin/settings/time');
      const data: SystemSetting = res.data;
      setStartTime(data.startTime);
      setEndTime(data.endTime);
      const mt = data.managementTimes || [];
      setManagementTimes(mt);
      // conversionTimes は managementTimes.length + 1 個必要
      const ct = data.conversionTimes || [];
      const expected = mt.length + 1;
      if (ct.length === expected) {
        setConversionTimes(ct);
      } else {
        setConversionTimes(Array(expected).fill(0));
      }
    } catch (err: any) {
      console.error('Failed to fetch time settings:', err);
      setTimeError('設定の取得に失敗しました');
    } finally {
      setTimeLoading(false);
    }
  };

  const handleSaveTimeSettings = async () => {
    try {
      setTimeLoading(true);
      setTimeMessage('');
      setTimeError('');
      await api.put('/admin/settings/time', {
        startTime,
        endTime,
        managementTimes,
        conversionTimes
      });
      setTimeMessage('設定を保存しました');
    } catch (err: any) {
      setTimeError('設定の保存に失敗しました');
    } finally {
      setTimeLoading(false);
    }
  };

  const handleAddManagementTime = () => {
    setManagementTimes([...managementTimes, '12:00']);
    // 新しい管理時刻の後ろに換算時間を追加（最後の換算時間の後）
    setConversionTimes([...conversionTimes, 0]);
  };

  const handleUpdateManagementTime = (index: number, value: string) => {
    const updated = [...managementTimes];
    updated[index] = value;
    setManagementTimes(updated);
  };

  const handleRemoveManagementTime = (index: number) => {
    setManagementTimes(managementTimes.filter((_, i) => i !== index));
    // 管理時刻[index]の後ろの換算時間(index+1)を削除
    setConversionTimes(conversionTimes.filter((_, i) => i !== index + 1));
  };

  const handleUpdateConversionTime = (index: number, value: number) => {
    const updated = [...conversionTimes];
    updated[index] = Math.floor(value);
    setConversionTimes(updated);
  };

  // User modal helpers
  const openCreateUserModal = () => {
    setEditingUserId(null);
    setUserEmail(''); setUserPassword(''); setUserFirstName(''); setUserLastName('');
    setUserIsAdmin(false); setUserGroupIds([]); setUserError('');
    setShowUserModal(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUserId(u.id);
    setUserEmail(u.email); setUserPassword(''); setUserFirstName(u.firstName); setUserLastName(u.lastName);
    setUserIsAdmin(u.isAdmin);
    setUserGroupIds(u.groupMembers?.map((gm) => gm.group.id) || []);
    setUserError('');
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUserId(null);
    setUserError('');
  };

  const handleSubmitUser = async (e: FormEvent) => {
    e.preventDefault();
    setUserError('');
    try {
      const data: any = { email: userEmail, firstName: userFirstName, lastName: userLastName, isAdmin: userIsAdmin, groupIds: userGroupIds };
      if (editingUserId) {
        if (userPassword) data.password = userPassword;
        await api.put(`/admin/users/${editingUserId}`, data);
      } else {
        data.password = userPassword;
        await api.post('/admin/users', data);
      }
      closeUserModal();
      loadAll();
    } catch (err: any) {
      setUserError(err.response?.data?.error || (editingUserId ? '更新に失敗しました' : '作成に失敗しました'));
    }
  };

  const toggleUserGroup = (groupId: number) => {
    setUserGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleDeleteItem = async (type: string, id: number) => {
    setDeletingIds((prev) => new Set([...prev, id]));
    setConfirmDelete(null);
    try {
      await api.delete(`/admin/${type}/${id}`);
      console.log(`${type} ${id}削除成功`);
      setTimeout(() => loadAll(), 300);
    } catch (error: any) {
      console.error(`${type}削除エラー:`, error.response?.data || error.message);
      alert(`削除に失敗しました: ${error.response?.data?.error || error.message}`);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const moveItem = async (type: 'trackers' | 'statuses' | 'priorities' | 'roles', index: number, direction: 'up' | 'down') => {
    // kept for keyboard accessibility, but drag/drop is preferred
    const list = type === 'trackers' ? trackers : type === 'statuses' ? statuses : type === 'priorities' ? priorities : roles;
    const newList = [...list] as any[]; // union type, will cast later for setters
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newList.length) return;
    [newList[index], newList[swapIdx]] = [newList[swapIdx], newList[index]];
    if (type === 'trackers') setTrackers(newList as Tracker[]);
    else if (type === 'statuses') setStatuses(newList as IssueStatus[]);
    else if (type === 'priorities') setPriorities(newList as IssuePriority[]);
    else if (type === 'roles') setRoles(newList as Role[]);
    try {
      await api.post(`/admin/${type}/reorder`, { ids: newList.map((i) => i.id) });
    } catch (e) {
      console.error('reorder failed', e);
    }
  };

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  // Master modal helpers
  const getMasterListLabel = () => {
    switch (masterType) {
      case 'roles': return 'ロール';
      case 'trackers': return 'トラッカー';
      case 'statuses': return 'ステータス';
      case 'priorities': return '優先度';
      default: return '';
    }
  };

  const openCreateMasterModal = (type: 'roles' | 'trackers' | 'statuses' | 'priorities') => {
    setMasterType(type);
    setEditingMasterId(null);
    setMasterName('');
    setMasterError('');
    setMasterStatusIds([]);
    setMasterTransitions(new Set());
    setMasterIsDefaultRole(false);
    setShowMasterModal(true);
  };

  const openEditMasterModal = async (type: 'roles' | 'trackers' | 'statuses' | 'priorities', item: any) => {
    setMasterType(type);
    setEditingMasterId(item.id);
    setMasterName(item.name);
    setMasterError('');
    if (type === 'roles' && item.statuses) {
      setMasterStatusIds(item.statuses.map((s: any) => s.statusId));
      setMasterIsDefaultRole(!!item.isDefaultRole);
      try {
        const res = await api.get(`/admin/roles/${item.id}/transitions`);
        const set = new Set<string>();
        res.data.forEach((t: { oldStatusId: number; newStatusId: number }) => {
          set.add(`${t.oldStatusId}-${t.newStatusId}`);
        });
        setMasterTransitions(set);
      } catch {
        setMasterTransitions(new Set());
      }
    } else {
      setMasterStatusIds([]);
      setMasterTransitions(new Set());
      setMasterIsDefaultRole(false);
    }
    setShowMasterModal(true);
  };

  const closeMasterModal = () => {
    setShowMasterModal(false);
    setMasterType(null);
    setEditingMasterId(null);
    setMasterError('');
    setMasterStatusIds([]);
    setMasterTransitions(new Set());
    setMasterIsDefaultRole(false);
  };

  const handleSubmitMaster = async (e: FormEvent) => {
    e.preventDefault();
    setMasterError('');
    try {
      if (!masterType) return;
      const data: any = { name: masterName };
      if (masterType === 'roles') {
        data.statusIds = masterStatusIds;
        data.isDefaultRole = masterIsDefaultRole;
      }
      if (editingMasterId) {
        await api.put(`/admin/${masterType}/${editingMasterId}`, data);
        if (masterType === 'roles') {
          const transitions = Array.from(masterTransitions).map((key) => {
            const [oldStatusId, newStatusId] = key.split('-').map(Number);
            return { oldStatusId, newStatusId };
          });
          await api.put(`/admin/roles/${editingMasterId}/transitions`, { transitions });
        }
      } else {
        const res = await api.post(`/admin/${masterType}`, data);
        if (masterType === 'roles' && masterTransitions.size > 0) {
          const transitions = Array.from(masterTransitions).map((key) => {
            const [oldStatusId, newStatusId] = key.split('-').map(Number);
            return { oldStatusId, newStatusId };
          });
          await api.put(`/admin/roles/${res.data.id}/transitions`, { transitions });
        }
      }
      closeMasterModal();
      loadAll();
    } catch (err: any) {
      setMasterError(err.response?.data?.error || (editingMasterId ? '更新に失敗しました' : '作成に失敗しました'));
    }
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggingIdx(idx);
    e.dataTransfer.setData('text/plain', idx.toString());
    e.dataTransfer.effectAllowed = 'move';
    document.body.classList.add('grabbing-active');
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDropIdx(null);
    document.body.classList.remove('grabbing-active');
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIdx(idx);
  };

  const handleDrop = async (e: React.DragEvent, idx: number, type: 'trackers' | 'statuses' | 'priorities' | 'roles') => {
    e.preventDefault();
    setDropIdx(null);
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (isNaN(from) || from === idx) return;
    const list = type === 'trackers' ? trackers : type === 'statuses' ? statuses : type === 'priorities' ? priorities : roles;
    const newList = [...list] as any[];
    const [moved] = newList.splice(from, 1);
    newList.splice(idx, 0, moved);
    if (type === 'trackers') setTrackers(newList as Tracker[]);
    else if (type === 'statuses') setStatuses(newList as IssueStatus[]);
    else if (type === 'priorities') setPriorities(newList as IssuePriority[]);
    else if (type === 'roles') setRoles(newList as Role[]);
    try {
      await api.post(`/admin/${type}/reorder`, { ids: newList.map((i) => i.id) });
    } catch (err) {
      console.error('reorder failed', err);
    }
  };

  // Group modal helpers
  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setGroupName('');
    setGroupMemberIds([]);
    setGroupError('');
    setShowGroupModal(true);
  };

  const openEditGroupModal = async (group: Group) => {
    const res = await api.get(`/admin/groups/${group.id}`);
    const detail: Group = res.data;
    setEditingGroupId(group.id);
    setGroupName(detail.name);
    setGroupMemberIds(detail.members?.map((m) => m.userId) || []);
    setGroupError('');
    setShowGroupModal(true);
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setEditingGroupId(null);
    setGroupError('');
  };

  const handleSubmitGroup = async (e: FormEvent) => {
    e.preventDefault();
    setGroupError('');
    try {
      const data = { name: groupName, memberIds: groupMemberIds };
      if (editingGroupId) {
        await api.put(`/admin/groups/${editingGroupId}`, data);
        if (selectedGroup?.id === editingGroupId) {
          handleSelectGroup(editingGroupId);
        }
      } else {
        await api.post('/admin/groups', data);
      }
      closeGroupModal();
      loadAll();
    } catch (err: any) {
      setGroupError(err.response?.data?.error || (editingGroupId ? '更新に失敗しました' : '作成に失敗しました'));
    }
  };

  const handleDeleteGroup = async (id: number) => {
    await api.delete(`/admin/groups/${id}`);
    setConfirmDelete(null);
    if (selectedGroup?.id === id) setSelectedGroup(null);
    loadAll();
  };

  const handleSelectGroup = async (id: number) => {
    const res = await api.get(`/admin/groups/${id}`);
    setSelectedGroup(res.data);
  };

  const toggleGroupMember = (userId: number) => {
    setGroupMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };


  const tabs = [
    { key: 'users' as const, label: 'ユーザー' },
    { key: 'groups' as const, label: 'グループ' },
    { key: 'roles' as const, label: 'ロール' },
    { key: 'trackers' as const, label: 'トラッカー' },
    { key: 'statuses' as const, label: 'ステータス' },
    { key: 'priorities' as const, label: '優先度' },
    { key: 'time' as const, label: '時間' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">管理</h1>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={tab}
        onTabChange={(key) => {
          setTab(key as any);
          setSelectedGroup(null);
        }}
        className="mb-6"
      />

      {tab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={openCreateUserModal}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
              新規ユーザー
            </button>
          </div>

          <div className="bg-white rounded-lg shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ロール</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">グループ</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{u.lastName} {u.firstName}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.isAdmin && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">管理者</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.groupMembers?.map((gm) => gm.group.name).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditUserModal(u)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmDelete({ type: 'users', id: u.id, name: `${u.lastName} ${u.firstName}` })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">ユーザーが登録されていません</div>
            )}
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={openCreateGroupModal}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
              新規グループ
            </button>
          </div>

          <div className="bg-white rounded-lg shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">グループ名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">メンバー数</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelectGroup(group.id)}>
                    <td className="px-4 py-3 text-sky-600 font-medium">{group.name}</td>
                    <td className="px-4 py-3 text-gray-600">{group._count?.members || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={(e) => { e.stopPropagation(); openEditGroupModal(group); }} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'groups', id: group.id, name: group.name }); }} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {groups.length === 0 && (
              <div className="text-center py-8 text-gray-500">グループが登録されていません</div>
            )}
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => openCreateMasterModal('roles')}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
              新規ロール
            </button>
          </div>

          <div className="bg-white rounded-lg shadow">
            {roles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">ロールが登録されていません</div>
            ) : (
              roles.map((item, i) => {
                const isDragging = draggingIdx === i;
                const isDropTarget = dropIdx === i && draggingIdx !== i;
                const isDeleting = deletingIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i, 'roles')}
                    className={[
                      'flex items-center justify-between px-5 py-3 transition-all',
                      i > 0 ? 'border-t' : '',
                      isDragging ? 'opacity-40 scale-95 shadow-lg' : 'animate-drop-in',
                      isDropTarget ? 'bg-sky-50 border-l-4 border-sky-500' : 'hover:bg-gray-50',
                      isDeleting ? 'animate-fade-out' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="flex items-center gap-3 flex-grow">
                      <div className="p-1 -m-1 text-gray-400 hover:text-sky-500 cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span>{item.name}</span>
                      {item.isDefaultRole && (
                        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">初期ロール</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditMasterModal('roles', item)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete({ type: 'roles', id: item.id, name: item.name })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}


      {(tab === 'trackers' || tab === 'statuses' || tab === 'priorities') && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => openCreateMasterModal(tab as 'trackers' | 'statuses' | 'priorities')}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm">
              {tab === 'trackers' ? '新規トラッカー' : tab === 'statuses' ? '新規ステータス' : '新規優先度'}
            </button>
          </div>

          <div className="bg-white rounded-lg shadow">
            {(() => {
              const list = tab === 'trackers' ? trackers : tab === 'statuses' ? statuses : priorities;
              if (list.length === 0) {
                return <div className="text-center py-8 text-gray-500">{tab === 'trackers' ? 'トラッカーが' : tab === 'statuses' ? 'ステータスが' : '優先度が'}登録されていません</div>;
              }
              return list.map((item: any, i: number) => {
                const isDragging = draggingIdx === i;
                const isDropTarget = dropIdx === i && draggingIdx !== i;
                const isDeleting = deletingIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i, tab as 'trackers' | 'statuses' | 'priorities')}
                    className={[
                      'flex items-center justify-between px-5 py-3 transition-all',
                      i > 0 ? 'border-t' : '',
                      isDragging ? 'opacity-40 scale-95 shadow-lg' : 'animate-drop-in',
                      isDropTarget ? 'bg-sky-50 border-l-4 border-sky-500' : 'hover:bg-gray-50',
                      isDeleting ? 'animate-fade-out' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="flex items-center gap-3 flex-grow">
                      <div className="p-1 -m-1 text-gray-400 hover:text-sky-500 cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span>{item.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditMasterModal(tab as 'trackers' | 'statuses' | 'priorities', item)} title="編集" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete({ type: tab, id: item.id, name: item.name })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {tab === 'time' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-600" />
                <h2 className="text-lg font-semibold text-slate-800">営業時間・管理時刻設定</h2>
              </div>
              <button
                onClick={handleAddManagementTime}
                className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium px-2 py-1 bg-sky-50 rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
                管理時刻を追加
              </button>
            </div>

            {timeMessage && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm animate-drop-in">{timeMessage}</div>}
            {timeError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm animate-drop-in">{timeError}</div>}

            {/* タイムライン縦並びレイアウト */}
            <div className="flex">
              {/* 左: ドット＋縦線 */}
              <div className="flex flex-col items-center mr-4">
                <div className="w-3 h-3 rounded-full bg-sky-500 mt-8 shrink-0" />
                <div className="w-0.5 bg-gray-200 flex-1 my-1" />
                {managementTimes.map((_, i) => (
                  <div key={i} className="contents">
                    <div className="w-3 h-3 rounded-full bg-amber-400 mt-1 shrink-0" />
                    <div className="w-0.5 bg-gray-200 flex-1 my-1" />
                  </div>
                ))}
                <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0" />
              </div>

              {/* 右: コンテンツ */}
              <div className="flex-1 min-w-0">
                {/* 開始時刻 */}
                <div className="mb-1">
                  <label className="block text-xs font-semibold text-sky-600 mb-1">開始時刻</label>
                  <CustomTimePicker value={startTime} onChange={v => setStartTime(v)} showFloatingLabel={false} size="small" />
                </div>

                {/* 換算時間[0] */}
                <div className="py-2 px-3 bg-gray-50 rounded-md my-2 flex items-center gap-3">
                  <span className="text-xs text-gray-500 whitespace-nowrap">換算時間</span>
                  <NumberInput
                    min="0"
                    step="1"
                    value={conversionTimes[0] ?? 0}
                    onChange={e => handleUpdateConversionTime(0, parseInt(e.target.value) || 0)}
                    size="small"
                    showFloatingLabel={false}
                    endAdornment="時間"
                    className="w-28"
                  />
                </div>

                {/* 管理時刻ループ */}
                {managementTimes.map((time, index) => (
                  <div key={index} className="animate-drop-in">
                    <div className="mb-1 group flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs font-semibold text-amber-600 mb-1">管理時刻</label>
                        <CustomTimePicker
                          value={time}
                          onChange={v => handleUpdateManagementTime(index, v)}
                          showFloatingLabel={false}
                          size="small"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveManagementTime(index)}
                        className="mt-6 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 換算時間[index+1] */}
                    <div className="py-2 px-3 bg-gray-50 rounded-md my-2 flex items-center gap-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">換算時間</span>
                      <NumberInput
                        min="0"
                        step="1"
                        value={conversionTimes[index + 1] ?? 0}
                        onChange={e => handleUpdateConversionTime(index + 1, parseInt(e.target.value) || 0)}
                        size="small"
                        showFloatingLabel={false}
                        endAdornment="時間"
                        className="w-28"
                      />
                    </div>
                  </div>
                ))}

                {/* 終了時刻 */}
                <div className="mt-1">
                  <label className="block text-xs font-semibold text-rose-600 mb-1">終了時刻</label>
                  <CustomTimePicker value={endTime} onChange={v => setEndTime(v)} showFloatingLabel={false} size="small" />
                </div>
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <button
                onClick={handleSaveTimeSettings}
                disabled={timeLoading}
                className="w-full bg-sky-600 text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex justify-center items-center"
              >
                {timeLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    保存中...
                  </>
                ) : '設定を保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master data modal (roles, trackers, statuses, priorities) */}
      <Modal
        isOpen={showMasterModal && !!masterType}
        onClose={closeMasterModal}
        title={editingMasterId ? `${getMasterListLabel()}編集` : `${getMasterListLabel()}登録`}
      >
        {masterError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{masterError}</div>}
        <form onSubmit={handleSubmitMaster}>
          <div className="mb-4">
            <TextInput
              label="名前 *"
              value={masterName}
              onChange={(e) => setMasterName(e.target.value)}
              required
            />
          </div>

          {/* Role-specific isDefaultRole checkbox */}
          {masterType === 'roles' && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={masterIsDefaultRole}
                  onChange={(e) => setMasterIsDefaultRole(e.target.checked)}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm font-medium text-gray-700">プロジェクトの初期ロール</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">プロジェクト作成時に作成者へ自動で割り当てられるロールです。有効にできるのは1つのみです。</p>
            </div>
          )}

          {/* Role-specific status selection */}
          {masterType === 'roles' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">利用可能なステータス</label>
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {statuses.length > 0 ? (
                  statuses.map((s) => (
                    <label key={s.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                      <input type="checkbox" checked={masterStatusIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMasterStatusIds([...masterStatusIds, s.id]);
                          } else {
                            setMasterStatusIds(masterStatusIds.filter((id) => id !== s.id));
                          }
                        }}
                        className="mr-3 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                      <span className="text-sm">{s.name}</span>
                      {s.isClosed && <span className="ml-2 text-xs text-gray-400">(完了)</span>}
                    </label>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">ステータスがありません</div>
                )}
              </div>
            </div>
          )}

          {/* Workflow transition matrix */}
          {masterType === 'roles' && statuses.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">ステータス遷移</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => {
                    const set = new Set<string>();
                    statuses.forEach((from) => statuses.forEach((to) => {
                      if (from.id !== to.id) set.add(`${from.id}-${to.id}`);
                    }));
                    setMasterTransitions(set);
                  }} className="text-xs text-sky-600 hover:text-sky-800">全選択</button>
                  <button type="button" onClick={() => setMasterTransitions(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700">全解除</button>
                </div>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-r px-2 py-2 bg-gray-50 text-left text-gray-600 sticky left-0 z-10 min-w-[100px]">
                        現在 ＼ 遷移先
                      </th>
                      {statuses.map((s) => (
                        <th key={s.id} className="border-b px-2 py-2 bg-gray-50 text-center text-gray-600 min-w-[60px]">
                          <div className="truncate max-w-[80px]" title={s.name}>{s.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statuses.map((fromStatus) => (
                      <tr key={fromStatus.id} className="hover:bg-gray-50">
                        <td className="border-b border-r px-2 py-2 font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                          {fromStatus.name}
                        </td>
                        {statuses.map((toStatus) => {
                          const key = `${fromStatus.id}-${toStatus.id}`;
                          const isSame = fromStatus.id === toStatus.id;
                          return (
                            <td key={toStatus.id} className={`border-b px-2 py-2 text-center ${isSame ? 'bg-gray-100' : ''}`}>
                              {isSame ? (
                                <span className="text-gray-300">-</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={masterTransitions.has(key)}
                                  onChange={(e) => {
                                    const next = new Set(masterTransitions);
                                    if (e.target.checked) {
                                      next.add(key);
                                    } else {
                                      next.delete(key);
                                    }
                                    setMasterTransitions(next);
                                  }}
                                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">行: 現在のステータス、列: 遷移先のステータス</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeMasterModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
              {editingMasterId ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Group detail modal */}
      <Modal
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup?.name || 'グループ詳細'}
      >
        {selectedGroup && (
          <>
            <div className="text-sm mb-2">
              <span className="text-gray-500">登録日:</span>
              <span className="ml-2">{new Date(selectedGroup.createdAt).toLocaleDateString('ja-JP')}</span>
            </div>
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">メンバー ({selectedGroup.members?.length || 0})</h3>
              {selectedGroup.members && selectedGroup.members.length > 0 ? (
                <div className="space-y-1">
                  {selectedGroup.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded border text-sm">
                      <span>{m.user.lastName} {m.user.firstName}</span>
                      <span className="text-gray-400 text-xs">{m.user.email}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">メンバーがいません</p>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Group create/edit modal */}
      <Modal
        isOpen={showGroupModal}
        onClose={closeGroupModal}
        title={editingGroupId ? 'グループ編集' : 'グループ登録'}
      >
        {groupError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{groupError}</div>}
        <form onSubmit={handleSubmitGroup}>
          <div className="mb-4">
            <TextInput
              label="グループ名 *"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">メンバー</label>
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {users.map((u) => (
                <label key={u.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                  <input type="checkbox" checked={groupMemberIds.includes(u.id)}
                    onChange={() => toggleGroupMember(u.id)}
                    className="mr-3 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                  <span className="text-sm">{u.lastName} {u.firstName}</span>
                  <span className="text-xs text-gray-400 ml-2">{u.email}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{groupMemberIds.length} 名選択中</p>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeGroupModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
              {editingGroupId ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </Modal>

      {/* User create/edit modal */}
      <Modal
        isOpen={showUserModal}
        onClose={closeUserModal}
        title={editingUserId ? 'ユーザー編集' : 'ユーザー登録'}
      >
        {userError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{userError}</div>}
        <form onSubmit={handleSubmitUser}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <TextInput
              label="姓 *"
              value={userLastName}
              onChange={(e) => setUserLastName(e.target.value)}
              required
            />
            <TextInput
              label="名 *"
              value={userFirstName}
              onChange={(e) => setUserFirstName(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <TextInput
              label="メールアドレス *"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <TextInput
              label={`パスワード ${editingUserId ? '（変更する場合のみ入力）' : '*'}`}
              type="password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              required={!editingUserId}
            />
          </div>
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" checked={userIsAdmin} onChange={(e) => setUserIsAdmin(e.target.checked)}
                className="mr-2 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
              <span className="text-sm font-medium text-gray-700">システム管理者</span>
            </label>
          </div>
          <div className="mb-4">
            <Combobox
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              value={userGroupIds}
              onChange={(val: (string | number)[]) => setUserGroupIds(val.map(Number))}
              label="グループ"
              isMulti
              showFloatingLabel
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeUserModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
              {editingUserId ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!confirmDelete}
        title={confirmDelete?.type === 'users' ? 'ユーザーの削除' : confirmDelete?.type === 'groups' ? 'グループの削除' : 'データの削除'}
        message={`${confirmDelete?.name} を削除しますか？この操作は取り消せません。`}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === 'groups') {
            handleDeleteGroup(confirmDelete.id);
          } else {
            handleDeleteItem(confirmDelete.type, confirmDelete.id);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        variant="danger"
      />
    </div>
  );
}

