import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionMap } from '../types';

interface Props {
  code: string;
  permissions?: PermissionMap;
  children: ReactNode;
}

export default function PermissionRoute({ code, permissions, children }: Props) {
  const { canUse } = usePermissions(permissions);
  if (!canUse(code)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
