import api from '../api/client';
import type { PermissionMap } from '../types';

const cache = new Map<number, { map: PermissionMap; at: number }>();
const TTL_MS = 60_000;

export function peekProjectPermissions(projectId: number): PermissionMap | undefined {
  const hit = cache.get(projectId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) return undefined;
  return hit.map;
}

export function setProjectPermissionsCache(projectId: number, map: PermissionMap) {
  cache.set(projectId, { map, at: Date.now() });
}

export async function getCachedProjectPermissions(projectId: number): Promise<PermissionMap> {
  const hit = peekProjectPermissions(projectId);
  if (hit) return hit;
  const res = await api.get(`/projects/${projectId}`);
  const map: PermissionMap = res.data.myPermissions ?? {};
  setProjectPermissionsCache(projectId, map);
  return map;
}

export async function prefetchProjectPermissions(projectIds: number[]): Promise<Record<number, PermissionMap>> {
  const unique = [...new Set(projectIds.filter((id) => Number.isFinite(id) && id > 0))];
  const result: Record<number, PermissionMap> = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        result[id] = await getCachedProjectPermissions(id);
      } catch {
        result[id] = {};
      }
    })
  );
  return result;
}

export function projectMapCanInput(map: PermissionMap | undefined, code: string): boolean {
  return map?.[code]?.canInput === true;
}
