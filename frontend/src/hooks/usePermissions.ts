import { useMemo } from 'react';
import { codesForFieldInputCheck } from '../constants/fieldPermissionAliases';
import { PermissionMap } from '../types';

export function usePermissions(permissions?: PermissionMap) {
  return useMemo(() => {
    const map = permissions ?? {};
    const canUse = (code: string) => map[code]?.canUse === true;
    const canInput = (code: string) => map[code]?.canInput === true;
    const canInputField = (code: string) =>
      codesForFieldInputCheck(code).some((c) => map[c]?.canInput === true);
    return { canUse, canInput, canInputField, permissions: map };
  }, [permissions]);
}
