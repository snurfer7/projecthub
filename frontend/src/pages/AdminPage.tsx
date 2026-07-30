import { useState, useEffect, useMemo, FormEvent, DragEvent } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api/client';
import { User, Tracker, IssueStatus, IssuePriority, Group, Role, SystemSetting, EmailSettings, PermissionSet, PermissionResource } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import PermissionSetsPanel from '../components/PermissionSetsPanel';
import HolidaySettingsPanel from '../components/HolidaySettingsPanel';
import PermissionMatrixEditor, { flattenPermissionResources, PermissionMatrixRow } from '../components/PermissionMatrixEditor';
import { Pencil, Trash2, GripVertical, Clock, Plus, UserX, UserCheck, Mail } from 'lucide-react';
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

type UserAccountStatus = 'active' | 'pending' | 'inactive';

const USER_STATUS_FILTER_OPTIONS: { value: UserAccountStatus; label: string }[] = [
  { value: 'active', label: '有効' },
  { value: 'pending', label: '仮登録' },
  { value: 'inactive', label: '無効' },
];

const DEFAULT_USER_STATUS_FILTERS: UserAccountStatus[] = ['active', 'pending'];

export default function AdminPage({ user }: Props) {
  const [tab, setTab] = useState<'users' | 'groups' | 'permission-sets' | 'roles' | 'trackers' | 'statuses' | 'priorities' | 'time' | 'email' | 'holidays'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [priorities, setPriorities] = useState<IssuePriority[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);

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
  const [rolePermissionCatalog, setRolePermissionCatalog] = useState<PermissionResource[]>([]);
  const [masterRolePermissionRows, setMasterRolePermissionRows] = useState<PermissionMatrixRow[]>([]);

  // Group modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [groupPermissionSetId, setGroupPermissionSetId] = useState<number | ''>('');
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

  const [emailTransport, setEmailTransport] = useState<'ses' | 'smtp'>('ses');
  const [emailFromOverride, setEmailFromOverride] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [testToEmail, setTestToEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

  // 削除用ステート
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: number; name: string } | null>(null);
  const [confirmUserStatus, setConfirmUserStatus] = useState<{ id: number; name: string; nextStatus: 'active' | 'inactive' } | null>(null);
  const [confirmResendEmail, setConfirmResendEmail] = useState<{ id: number; name: string } | null>(null);

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilters, setUserStatusFilters] = useState<UserAccountStatus[]>(DEFAULT_USER_STATUS_FILTERS);

  const { canUse, canInput } = usePermissions(user.permissions);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (!userStatusFilters.includes(u.status as UserAccountStatus)) return false;
      if (!q) return true;
      const name = `${u.lastName} ${u.firstName}`.toLowerCase();
      const groups = (u.groupMembers?.map((gm) => gm.group.name).join(' ') ?? '').toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q) || groups.includes(q);
    });
  }, [users, userSearchQuery, userStatusFilters]);

  const toggleUserStatusFilter = (status: UserAccountStatus) => {
    setUserStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

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
    api.get('/admin/permission-sets').then((res) => setPermissionSets(res.data)).catch(console.error);
    api.get('/admin/permissions/resources', { params: { scope: 'role' } }).then((res) => setRolePermissionCatalog(res.data)).catch(console.error);
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (tab === 'time') {
      fetchTimeSettings();
    }
    if (tab === 'email') {
      fetchEmailSettings();
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

  const fetchEmailSettings = async () => {
    try {
      setEmailLoading(true);
      setEmailMessage('');
      setEmailError('');
      const res = await api.get<EmailSettings>('/admin/settings/email');
      const d = res.data;
      setEmailTransport(d.emailTransport);
      setEmailFromOverride(d.emailFromOverride ?? '');
      setSmtpHost(d.smtpHost ?? '');
      setSmtpPort(String(d.smtpPort ?? 587));
      setSmtpUser(d.smtpUser ?? '');
      setSmtpSecure(d.smtpSecure);
      setSmtpPasswordSet(d.smtpPasswordSet);
      setSmtpPassword('');
    } catch (err: any) {
      console.error('Failed to fetch email settings:', err);
      setEmailError('メール設定の取得に失敗しました');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    try {
      setEmailLoading(true);
      setEmailMessage('');
      setEmailError('');
      const body: Record<string, unknown> = {
        emailTransport,
        emailFromOverride: emailFromOverride.trim() || null,
        smtpHost: smtpHost.trim() || null,
        smtpPort: Number(smtpPort) || 587,
        smtpUser: smtpUser.trim() || null,
        smtpSecure,
      };
      if (smtpPassword.trim()) {
        body.smtpPassword = smtpPassword.trim();
      }
      const res = await api.put<EmailSettings>('/admin/settings/email', body);
      setSmtpPasswordSet(res.data.smtpPasswordSet);
      setSmtpPassword('');
      setEmailMessage('メール設定を保存しました');
    } catch (err: any) {
      setEmailError(err.response?.data?.error || '保存に失敗しました');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    const to = testToEmail.trim();
    if (!to) {
      setEmailError('テスト送信の宛先を入力してください');
      return;
    }
    try {
      setTestSending(true);
      setEmailMessage('');
      setEmailError('');
      await api.post('/admin/settings/email/test', { toEmail: to });
      setEmailMessage('テストメールを送信しました');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'テスト送信に失敗しました';
      const detail = err.response?.data?.details;
      setEmailError(detail ? `${msg}（${detail}）` : msg);
    } finally {
      setTestSending(false);
    }
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
        await api.post('/admin/users', data);
      }
      closeUserModal();
      loadAll();
    } catch (err: any) {
      setUserError(err.response?.data?.error || (editingUserId ? '更新に失敗しました' : '作成に失敗しました'));
    }
  };

  const handleUpdateUserStatus = async (id: number, nextStatus: 'active' | 'inactive') => {
    setConfirmUserStatus(null);
    try {
      await api.put(`/admin/users/${id}`, { status: nextStatus });
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error || 'ユーザーステータスの更新に失敗しました');
    }
  };

  const handleResendRegistrationEmail = async (id: number) => {
    setConfirmResendEmail(null);
    try {
      await api.post(`/admin/users/${id}/resend-registration-email`);
      alert('登録メールを再送しました');
    } catch (err: any) {
      alert(err.response?.data?.error || '登録メールの再送に失敗しました');
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
    setMasterRolePermissionRows(type === 'roles' ? flattenPermissionResources(rolePermissionCatalog) : []);
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
      const existing = new Map<number, { canUse: boolean; canInput: boolean }>(
        (item.permissions ?? []).map((p: any) => [p.resourceId as number, { canUse: !!p.canUse, canInput: !!p.canInput }])
      );
      setMasterRolePermissionRows(flattenPermissionResources(rolePermissionCatalog, 0, existing));
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
      setMasterRolePermissionRows([]);
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
    setMasterRolePermissionRows([]);
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
        data.permissions = masterRolePermissionRows
          .filter((r) => !r.readOnly)
          .map((r) => ({ resourceId: r.resourceId, canUse: r.canUse, canInput: r.canInput }));
      }
      if (editingMasterId) {
        await api.put(`/admin/${masterType}/${editingMasterId}`, data);
        if (masterType === 'roles') {
          const transitions = Array.from(masterTransitions)
            .map((key) => {
              const [oldStatusId, newStatusId] = key.split('-').map(Number);
              return { oldStatusId, newStatusId };
            })
            .filter((t) =>
              masterStatusIds.length === 0
              || (masterStatusIds.includes(t.oldStatusId) && masterStatusIds.includes(t.newStatusId))
            );
          await api.put(`/admin/roles/${editingMasterId}/transitions`, { transitions });
        }
      } else {
        const res = await api.post(`/admin/${masterType}`, data);
        if (masterType === 'roles') {
          // Create then update permissions (POST does not accept permissions yet)
          if (data.permissions?.length) {
            await api.put(`/admin/roles/${res.data.id}`, {
              name: masterName,
              statusIds: masterStatusIds,
              isDefaultRole: masterIsDefaultRole,
              permissions: data.permissions,
            });
          }
          if (masterTransitions.size > 0) {
            const transitions = Array.from(masterTransitions)
              .map((key) => {
                const [oldStatusId, newStatusId] = key.split('-').map(Number);
                return { oldStatusId, newStatusId };
              })
              .filter((t) =>
                masterStatusIds.length === 0
                || (masterStatusIds.includes(t.oldStatusId) && masterStatusIds.includes(t.newStatusId))
              );
            await api.put(`/admin/roles/${res.data.id}/transitions`, { transitions });
          }
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
    setGroupPermissionSetId('');
    setGroupError('');
    setShowGroupModal(true);
  };

  const openEditGroupModal = async (group: Group) => {
    const res = await api.get(`/admin/groups/${group.id}`);
    const detail: Group = res.data;
    setEditingGroupId(group.id);
    setGroupName(detail.name);
    setGroupMemberIds(detail.members?.map((m) => m.userId) || []);
    setGroupPermissionSetId(detail.permissionSetId ?? '');
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
      const data = {
        name: groupName,
        memberIds: groupMemberIds,
        permissionSetId: groupPermissionSetId === '' ? null : groupPermissionSetId,
      };
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
    { key: 'permission-sets' as const, label: '権限設定' },
    { key: 'roles' as const, label: 'ロール' },
    { key: 'trackers' as const, label: 'トラッカー' },
    { key: 'statuses' as const, label: 'ステータス' },
    { key: 'priorities' as const, label: '優先度' },
    { key: 'time' as const, label: '時間' },
    { key: 'email' as const, label: 'メール設定' },
    ...(canUse('admin.holiday-settings')
      ? [{ key: 'holidays' as const, label: '休日設定' }]
      : []),
  ];

  if (!canUse('admin')) return <Navigate to="/no-access" replace />;

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
          <div className="flex gap-3 mb-4 items-center">
            <div className="bg-white rounded-lg shadow p-3 flex-1 flex flex-wrap items-center gap-3">
              <span className="text-xs text-gray-500">検索:</span>
              <TextInput
                placeholder="氏名、メール、グループ名..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                size="small"
                showFloatingLabel={false}
                className="w-64"
              />
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">ステータス:</span>
                {USER_STATUS_FILTER_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userStatusFilters.includes(value)}
                      onChange={() => toggleUserStatusFilter(value)}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <span className="text-xs text-gray-400 ml-auto">{filteredUsers.length} 件</span>
            </div>
            <button onClick={openCreateUserModal}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm shrink-0">
              新規ユーザー
            </button>
          </div>

          <div className="bg-white rounded-lg shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ロール</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">グループ</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{u.lastName} {u.firstName}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.status === 'active' && <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">有効</span>}
                      {u.status === 'pending' && <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">仮登録</span>}
                      {u.status === 'inactive' && <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">無効</span>}
                    </td>
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
                        {u.status === 'active' && (
                          <button
                            onClick={() => setConfirmUserStatus({ id: u.id, name: `${u.lastName} ${u.firstName}`, nextStatus: 'inactive' })}
                            title="無効化"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                        {u.status === 'inactive' && (
                          <button
                            onClick={() => setConfirmUserStatus({ id: u.id, name: `${u.lastName} ${u.firstName}`, nextStatus: 'active' })}
                            title="有効化"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        {u.status === 'pending' && canInput('admin.users') && (
                          <button
                            onClick={() => setConfirmResendEmail({ id: u.id, name: `${u.lastName} ${u.firstName}` })}
                            title="登録メール再送"
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        {u.status === 'pending' && (
                          <button onClick={() => setConfirmDelete({ type: 'users', id: u.id, name: `${u.lastName} ${u.firstName}` })} title="削除" className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">ユーザーが登録されていません</div>
            )}
            {users.length > 0 && filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">条件に一致するユーザーがありません</div>
            )}
          </div>
        </div>
      )}

      {tab === 'permission-sets' && <PermissionSetsPanel />}

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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">権限設定</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">メンバー数</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelectGroup(group.id)}>
                    <td className="px-4 py-3 text-sky-600 font-medium">{group.name}</td>
                    <td className="px-4 py-3 text-gray-600">{group.permissionSet?.name || '-'}</td>
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

      {tab === 'email' && (
        <div className="max-w-xl">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
              <Mail className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-slate-800">メール送信設定</h2>
            </div>

            {emailMessage && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{emailMessage}</div>
            )}
            {emailError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm whitespace-pre-wrap">{emailError}</div>
            )}

            <p className="text-sm text-gray-600 mb-4">
              Amazon SES を API 経由で使うか、SES の SMTP エンドポイント等を経由するかを選べます。送信元は SES で検証済みのアドレス（またはドメイン）に合わせてください。
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">送信方式</span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="emailTransport"
                      checked={emailTransport === 'ses'}
                      onChange={() => setEmailTransport('ses')}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm">SES API（AWS SDK・従来方式）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="emailTransport"
                      checked={emailTransport === 'smtp'}
                      onChange={() => setEmailTransport('smtp')}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm">SMTP（Amazon SES SMTP など）</span>
                  </label>
                </div>
              </div>

              <TextInput
                label="送信元メールアドレス（任意）"
                type="email"
                value={emailFromOverride}
                onChange={(e) => setEmailFromOverride(e.target.value)}
                placeholder="空欄のときはサーバーの EMAIL_FROM を使用"
              />

              {emailTransport === 'smtp' && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                  <TextInput
                    label="SMTP ホスト *"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="例: email-smtp.ap-northeast-1.amazonaws.com"
                  />
                  <TextInput
                    label="ポート"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value.replace(/\D/g, '') || '587')}
                  />
                  <TextInput
                    label="SMTP ユーザー名 *"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                  />
                  <TextInput
                    label={smtpPasswordSet ? 'SMTP パスワード（変更する場合のみ）' : 'SMTP パスワード *'}
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={smtpPasswordSet ? '未入力のままなら現在のパスワードを維持' : ''}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm text-gray-700">SSL/TLS（ポート 465 等で接続開始時から TLS）</span>
                  </label>
                  <p className="text-xs text-gray-500">
                    587 番・STARTTLS の場合はチェックを外し、SES の SMTP 認証情報に合わせてください。
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveEmailSettings}
                disabled={emailLoading}
                className="w-full bg-sky-600 text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
              >
                {emailLoading ? '保存中…' : '設定を保存'}
              </button>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">テストメール送信</h3>
              <p className="text-xs text-gray-500 mb-3">保存済みの設定で 1 通送信します（先に「設定を保存」してください）。</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <TextInput
                    label="宛先メールアドレス"
                    type="email"
                    value={testToEmail}
                    onChange={(e) => setTestToEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testSending || emailLoading}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-md text-sm font-medium bg-white border border-sky-600 text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                  >
                    {testSending ? '送信中…' : 'テストメール送信'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'holidays' && <HolidaySettingsPanel user={user} />}

      {/* Master data modal (roles, trackers, statuses, priorities) */}
      <Modal
        isOpen={showMasterModal && !!masterType}
        onClose={closeMasterModal}
        title={editingMasterId ? `${getMasterListLabel()}編集` : `${getMasterListLabel()}登録`}
        footer={
          <>
            <button type="button" onClick={closeMasterModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button type="submit" form="admin-master-form" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
              {editingMasterId ? '更新' : '作成'}
            </button>
          </>
        }
      >
        {masterError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{masterError}</div>}
        <form id="admin-master-form" onSubmit={handleSubmitMaster}>
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

          {masterType === 'roles' && masterRolePermissionRows.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">プロジェクト権限</label>
              <p className="text-xs text-gray-500 mb-2">プロジェクト内の機能・項目をこのロールで制御します（グループの権限設定とは別です）。</p>
              <PermissionMatrixEditor rows={masterRolePermissionRows} onChange={setMasterRolePermissionRows} />
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
                    const matrixStatuses = masterStatusIds.length > 0
                      ? statuses.filter((s) => masterStatusIds.includes(s.id))
                      : statuses;
                    const set = new Set<string>();
                    matrixStatuses.forEach((from) => matrixStatuses.forEach((to) => {
                      if (from.id !== to.id) set.add(`${from.id}-${to.id}`);
                    }));
                    setMasterTransitions(set);
                  }} className="text-xs text-sky-600 hover:text-sky-800">全選択</button>
                  <button type="button" onClick={() => setMasterTransitions(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700">全解除</button>
                </div>
              </div>
              {(() => {
                const matrixStatuses = masterStatusIds.length > 0
                  ? statuses.filter((s) => masterStatusIds.includes(s.id))
                  : statuses;
                if (matrixStatuses.length === 0) {
                  return <p className="text-xs text-gray-400">利用可能なステータスを選択すると遷移マトリクスが表示されます</p>;
                }
                return (
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-r px-2 py-2 bg-gray-50 text-left text-gray-600 sticky left-0 z-10 min-w-[100px]">
                        現在 ＼ 遷移先
                      </th>
                      {matrixStatuses.map((s) => (
                        <th key={s.id} className="border-b px-2 py-2 bg-gray-50 text-center text-gray-600 min-w-[60px]">
                          <div className="truncate max-w-[80px]" title={s.name}>{s.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixStatuses.map((fromStatus) => (
                      <tr key={fromStatus.id} className="hover:bg-gray-50">
                        <td className="border-b border-r px-2 py-2 font-medium text-gray-700 bg-gray-50 sticky left-0 z-10">
                          {fromStatus.name}
                        </td>
                        {matrixStatuses.map((toStatus) => {
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
                );
              })()}
              <p className="text-xs text-gray-400 mt-1">行: 現在のステータス、列: 遷移先のステータス（利用可能なステータスのみ表示）</p>
            </div>
          )}

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
            <div className="text-sm mb-2">
              <span className="text-gray-500">権限設定:</span>
              <span className="ml-2">{selectedGroup.permissionSet?.name || '未割当'}</span>
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
        footer={
          <>
            <button type="button" onClick={closeGroupModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
            <button type="submit" form="admin-group-form" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
              {editingGroupId ? '更新' : '作成'}
            </button>
          </>
        }
      >
        {groupError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{groupError}</div>}
        <form id="admin-group-form" onSubmit={handleSubmitGroup}>
          <div className="mb-4">
            <TextInput
              label="グループ名 *"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">権限設定</label>
            <select
              value={groupPermissionSetId}
              onChange={(e) => setGroupPermissionSetId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">未割当</option>
              {permissionSets.map((ps) => (
                <option key={ps.id} value={ps.id}>{ps.name}</option>
              ))}
            </select>
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
        </form>
      </Modal>

      {/* User create/edit modal */}
      <Modal
        isOpen={showUserModal}
        onClose={closeUserModal}
        title={editingUserId ? 'ユーザー編集' : 'ユーザー登録'}
        footer={
          <>
            <button type="button" onClick={closeUserModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">キャンセル</button>
            <button type="submit" form="admin-user-form" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 transition-colors">
              {editingUserId ? '更新' : '作成'}
            </button>
          </>
        }
      >
        {userError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{userError}</div>}
        <form id="admin-user-form" onSubmit={handleSubmitUser}>
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
          {editingUserId && (
            <div className="mb-4">
              <TextInput
                label="パスワード（変更する場合のみ入力）"
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
              />
            </div>
          )}
          {!editingUserId && (
            <p className="mb-4 text-xs text-gray-500">
              仮パスワードは自動生成され、ユーザーのメールアドレスへ通知されます。
            </p>
          )}
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

      <ConfirmationModal
        isOpen={!!confirmUserStatus}
        title={confirmUserStatus?.nextStatus === 'inactive' ? 'ユーザーの無効化' : 'ユーザーの有効化'}
        message={
          confirmUserStatus
            ? `${confirmUserStatus.name} を${confirmUserStatus.nextStatus === 'inactive' ? '無効化' : '有効化'}しますか？`
            : ''
        }
        onConfirm={() => {
          if (!confirmUserStatus) return;
          handleUpdateUserStatus(confirmUserStatus.id, confirmUserStatus.nextStatus);
        }}
        onCancel={() => setConfirmUserStatus(null)}
        variant="info"
      />

      <ConfirmationModal
        isOpen={!!confirmResendEmail}
        title="登録メールの再送"
        message={
          confirmResendEmail
            ? `${confirmResendEmail.name} に仮パスワードを更新して登録メールを再送します。よろしいですか？`
            : ''
        }
        onConfirm={() => {
          if (!confirmResendEmail) return;
          handleResendRegistrationEmail(confirmResendEmail.id);
        }}
        onCancel={() => setConfirmResendEmail(null)}
        variant="info"
      />
    </div>
  );
}

