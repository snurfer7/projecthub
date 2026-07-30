import { Project, PermissionMap } from '../types';

/** True when the project's myPermissions allow the given action. */
export function projectCanUse(project: Project | null | undefined, code: string): boolean {
  return !!project?.myPermissions?.[code]?.canUse;
}

export function projectCanInput(project: Project | null | undefined, code: string): boolean {
  return !!project?.myPermissions?.[code]?.canInput;
}

export function getProjectPermissionMap(project: Project | null | undefined): PermissionMap {
  return project?.myPermissions ?? {};
}
