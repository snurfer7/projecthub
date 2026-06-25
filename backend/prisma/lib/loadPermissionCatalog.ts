import path from 'path';
import { createRequire } from 'module';

const cjsRequire = createRequire(__filename);

type PermissionCatalogModule = {
  flattenPermissionCatalog: (
    entries?: unknown[],
    parentCode?: string
  ) => Array<{
    code: string;
    name: string;
    resourceType?: 'feature' | 'field';
    position?: number;
    parentCode?: string;
  }>;
};

/** 開発（tsx / prisma/lib）と本番（dist/prisma/lib）の両方から dist のカタログを読み込む */
export function loadPermissionCatalog(): PermissionCatalogModule {
  const candidates = [
    path.join(__dirname, '../../dist/constants/permissionCatalog'),
    path.join(__dirname, '../../src/constants/permissionCatalog'),
    path.join(__dirname, '../../constants/permissionCatalog'),
  ];
  for (const candidate of candidates) {
    try {
      return cjsRequire(candidate) as PermissionCatalogModule;
    } catch {
      // try next path
    }
  }
  throw new Error(
    'permissionCatalog が見つかりません。先に npm run build を実行し、dist/constants/permissionCatalog.js を生成してください。'
  );
}
