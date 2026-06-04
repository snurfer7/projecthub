import { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionMap } from '../types';

interface Props {
  code: string;
  action?: 'use' | 'input';
  permissions?: PermissionMap;
  fallback?: ReactNode;
  children: ReactNode | ((allowed: boolean) => ReactNode);
}

export default function PermissionGate({ code, action = 'use', permissions, fallback = null, children }: Props) {
  const { canUse, canInput } = usePermissions(permissions);
  const allowed = action === 'use' ? canUse(code) : canInput(code);

  if (typeof children === 'function') {
    return <>{children(allowed)}</>;
  }
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
