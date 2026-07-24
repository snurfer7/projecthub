export type PermissionCatalogEntry = {
  code: string;
  name: string;
  resourceType?: 'feature' | 'field';
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
    position: 10,
    children: [
      { code: 'projects.overview', name: '概要', position: 0 },
      {
        code: 'projects.issues',
        name: 'チケット',
        position: 1,
        children: [
          { code: 'projects.issues.fields.subject', name: '題名', resourceType: 'field', position: 0 },
          { code: 'projects.issues.fields.tracker', name: 'トラッカー', resourceType: 'field', position: 1 },
          { code: 'projects.issues.fields.status', name: 'ステータス', resourceType: 'field', position: 2 },
          { code: 'projects.issues.fields.priority', name: '優先度', resourceType: 'field', position: 3 },
          { code: 'projects.issues.fields.assignee', name: '担当者', resourceType: 'field', position: 4 },
          { code: 'projects.issues.fields.parent', name: '親チケット', resourceType: 'field', position: 5 },
          { code: 'projects.issues.fields.description', name: '説明', resourceType: 'field', position: 6 },
          { code: 'projects.issues.fields.startDateTime', name: '開始日時', resourceType: 'field', position: 7 },
          { code: 'projects.issues.fields.endDateTime', name: '終了日時', resourceType: 'field', position: 8 },
          { code: 'projects.issues.fields.estimatedHours', name: '予定工数', resourceType: 'field', position: 9 },
          { code: 'projects.issues.fields.dueDate', name: '期日', resourceType: 'field', position: 10 },
          { code: 'projects.issues.fields.doneRatio', name: '進捗率', resourceType: 'field', position: 11 },
        ],
      },
      { code: 'projects.wiki', name: 'Wiki', position: 2 },
      { code: 'projects.comments', name: 'コメント', position: 3 },
      { code: 'projects.kanban', name: 'カンバン', position: 4 },
      { code: 'projects.gantt', name: 'ガント', position: 5 },
      { code: 'projects.time-entries', name: '工数', position: 6 },
      { code: 'projects.members', name: 'メンバー', position: 7 },
      { code: 'projects.saved-searches', name: '保存済み検索', position: 8 },
      { code: 'projects.activities', name: '活動履歴', position: 9 },
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
      { code: 'companies.activities', name: '活動履歴', position: 8 },
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
      { code: 'admin.groups', name: 'グループ', position: 1 },
      { code: 'admin.permission-sets', name: '権限設定', position: 2 },
      { code: 'admin.roles', name: 'ロール', position: 3 },
      { code: 'admin.trackers', name: 'トラッカー', position: 4 },
      { code: 'admin.statuses', name: 'ステータス', position: 5 },
      { code: 'admin.priorities', name: '優先度', position: 6 },
      { code: 'admin.time-settings', name: '時間設定', position: 7 },
      { code: 'admin.email-settings', name: 'メール設定', position: 8 },
    ],
  },
];

export function flattenPermissionCatalog(
  entries: PermissionCatalogEntry[] = PERMISSION_CATALOG,
  parentCode?: string
): Array<{ code: string; name: string; resourceType: string; position: number; parentCode?: string }> {
  const result: Array<{ code: string; name: string; resourceType: string; position: number; parentCode?: string }> = [];
  for (const entry of entries) {
    result.push({
      code: entry.code,
      name: entry.name,
      resourceType: entry.resourceType ?? 'feature',
      position: entry.position ?? 0,
      parentCode,
    });
    if (entry.children?.length) {
      result.push(...flattenPermissionCatalog(entry.children, entry.code));
    }
  }
  return result;
}
