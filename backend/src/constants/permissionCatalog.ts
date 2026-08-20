export type PermissionScope = 'group' | 'role';

export type PermissionCatalogEntry = {
  code: string;
  name: string;
  resourceType?: 'feature' | 'field';
  /** group = PermissionSet, role = Role. Defaults: projects children are role; others group. */
  scope?: PermissionScope;
  position?: number;
  children?: PermissionCatalogEntry[];
};

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { code: 'home', name: 'ホーム', position: 0 },
  { code: 'dashboard', name: 'ダッシュボード', position: 1 },
  {
    code: 'settings',
    name: '設定',
    position: 2,
    children: [
      { code: 'settings.fields.authMethod', name: '認証方式', resourceType: 'field', position: 0 },
      { code: 'settings.fields.microsoftAccount', name: 'Microsoft アカウント連携', resourceType: 'field', position: 1 },
    ],
  },
  {
    code: 'projects',
    name: 'プロジェクト',
    scope: 'group',
    position: 10,
    children: [
      { code: 'projects.overview', name: 'プロジェクト情報', scope: 'role', position: 0 },
      { code: 'projects.members', name: 'メンバー', scope: 'role', position: 1 },
      {
        code: 'projects.issues',
        name: 'チケット',
        scope: 'role',
        position: 2,
        children: [
          { code: 'projects.issues.fields.subject', name: '題名', resourceType: 'field', scope: 'role', position: 0 },
          { code: 'projects.issues.fields.tracker', name: 'トラッカー', resourceType: 'field', scope: 'role', position: 1 },
          { code: 'projects.issues.fields.status', name: 'ステータス', resourceType: 'field', scope: 'role', position: 2 },
          { code: 'projects.issues.fields.priority', name: '優先度', resourceType: 'field', scope: 'role', position: 3 },
          { code: 'projects.issues.fields.assignee', name: '担当者', resourceType: 'field', scope: 'role', position: 4 },
          { code: 'projects.issues.fields.parent', name: '親チケット', resourceType: 'field', scope: 'role', position: 5 },
          { code: 'projects.issues.fields.project', name: 'プロジェクト', resourceType: 'field', scope: 'role', position: 6 },
          { code: 'projects.issues.fields.description', name: '説明', resourceType: 'field', scope: 'role', position: 7 },
          { code: 'projects.issues.fields.startDateTime', name: '開始日時', resourceType: 'field', scope: 'role', position: 8 },
          { code: 'projects.issues.fields.endDateTime', name: '終了日時', resourceType: 'field', scope: 'role', position: 9 },
          { code: 'projects.issues.fields.estimatedHours', name: '予定工数', resourceType: 'field', scope: 'role', position: 10 },
          { code: 'projects.issues.fields.dueDate', name: '期日', resourceType: 'field', scope: 'role', position: 11 },
          { code: 'projects.issues.fields.doneRatio', name: '進捗率', resourceType: 'field', scope: 'role', position: 12 },
        ],
      },
      { code: 'projects.wiki', name: 'Wiki', scope: 'role', position: 3 },
      { code: 'projects.comments', name: 'コメント', scope: 'role', position: 4 },
      { code: 'projects.kanban', name: 'カンバン', scope: 'role', position: 5 },
      { code: 'projects.gantt', name: 'ガント', scope: 'role', position: 6 },
      { code: 'projects.time-entries', name: '工数', scope: 'role', position: 7 },
      { code: 'projects.activities', name: '活動履歴', scope: 'role', position: 8 },
      /** プロジェクト一覧機能のためグループ権限（ロール対象外） */
      { code: 'projects.saved-searches', name: '保存済み検索', scope: 'group', position: 0 },
    ],
  },
  {
    code: 'companies',
    name: '企業',
    position: 20,
    children: [
      { code: 'companies.fields.name', name: '企業名', resourceType: 'field', position: 0 },
      { code: 'companies.fields.website', name: 'Webサイト', resourceType: 'field', position: 1 },
      { code: 'companies.fields.notes', name: '備考', resourceType: 'field', position: 2 },
      { code: 'companies.fields.legalEntityStatus', name: '法人格', resourceType: 'field', position: 3 },
      { code: 'companies.fields.legalEntityPosition', name: '法人格位置', resourceType: 'field', position: 4 },
      {
        code: 'companies.locations',
        name: '拠点',
        position: 5,
        children: [
          { code: 'companies.locations.fields.name', name: '拠点名', resourceType: 'field', position: 0 },
          { code: 'companies.locations.fields.phone', name: '電話', resourceType: 'field', position: 1 },
          { code: 'companies.locations.fields.fax', name: 'FAX', resourceType: 'field', position: 2 },
          { code: 'companies.locations.fields.address', name: '住所', resourceType: 'field', position: 3 },
          { code: 'companies.locations.fields.notes', name: '備考', resourceType: 'field', position: 4 },
        ],
      },
      {
        code: 'companies.contacts',
        name: '担当者',
        position: 6,
        children: [
          { code: 'companies.contacts.fields.name', name: '氏名', resourceType: 'field', position: 0 },
          { code: 'companies.contacts.fields.email', name: 'メール', resourceType: 'field', position: 1 },
          { code: 'companies.contacts.fields.phone', name: '電話', resourceType: 'field', position: 2 },
          { code: 'companies.contacts.fields.department', name: '部署', resourceType: 'field', position: 3 },
          { code: 'companies.contacts.fields.position', name: '役職', resourceType: 'field', position: 4 },
        ],
      },
      { code: 'companies.deals', name: '商談', position: 7 },
      {
        code: 'companies.activities',
        name: '活動履歴',
        position: 8,
        children: [
          { code: 'companies.activities.fields.location', name: '拠点', resourceType: 'field', position: 0 },
        ],
      },
      { code: 'companies.wiki', name: 'Wiki', position: 9 },
      { code: 'companies.comments', name: 'コメント', position: 10 },
      { code: 'companies.merge', name: '統合', position: 11 },
    ],
  },
  { code: 'deals', name: '商談一覧', position: 21 },
  { code: 'contacts', name: '連絡先一覧', position: 22 },
  { code: 'associations', name: '協会', position: 23 },
  { code: 'legal-entity-statuses', name: '法人格', position: 24 },
  {
    code: 'admin',
    name: '管理',
    position: 30,
    children: [
      { code: 'admin.users', name: 'ユーザー', position: 0 },
      {
        code: 'admin.groups',
        name: 'グループ',
        position: 1,
        children: [
          { code: 'admin.groups.fields.parentGroups', name: '親グループ', resourceType: 'field', position: 0 },
          { code: 'admin.groups.fields.childGroups', name: '子グループ', resourceType: 'field', position: 1 },
        ],
      },
      { code: 'admin.permission-sets', name: '権限設定', position: 2 },
      { code: 'admin.roles', name: 'ロール', position: 3 },
      { code: 'admin.trackers', name: 'トラッカー', position: 4 },
      {
        code: 'admin.statuses',
        name: 'ステータス',
        position: 5,
        children: [
          { code: 'admin.statuses.fields.isClosed', name: '終了', resourceType: 'field', position: 0 },
        ],
      },
      { code: 'admin.priorities', name: '優先度', position: 6 },
      { code: 'admin.time-settings', name: '時間設定', position: 7 },
      { code: 'admin.email-settings', name: 'メール設定', position: 8 },
      { code: 'admin.holiday-settings', name: '休日設定', position: 9 },
      { code: 'admin.notification-settings', name: '通知設定', position: 10 },
    ],
  },
];

export type FlatPermissionCatalogEntry = {
  code: string;
  name: string;
  resourceType: string;
  scope: PermissionScope;
  position: number;
  parentCode?: string;
};

function inferScope(entry: PermissionCatalogEntry, parentScope?: PermissionScope): PermissionScope {
  if (entry.scope) return entry.scope;
  if (parentScope === 'role') return 'role';
  return 'group';
}

export function flattenPermissionCatalog(
  entries: PermissionCatalogEntry[] = PERMISSION_CATALOG,
  parentCode?: string,
  parentScope?: PermissionScope
): FlatPermissionCatalogEntry[] {
  const result: FlatPermissionCatalogEntry[] = [];
  for (const entry of entries) {
    const scope = inferScope(entry, parentScope);
    result.push({
      code: entry.code,
      name: entry.name,
      resourceType: entry.resourceType ?? 'feature',
      scope,
      position: entry.position ?? 0,
      parentCode,
    });
    if (entry.children?.length) {
      result.push(...flattenPermissionCatalog(entry.children, entry.code, scope));
    }
  }
  return result;
}
