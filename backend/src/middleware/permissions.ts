import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { hasPermission, resolveUserPermissions, PermissionMap } from '../services/permissions';

declare module './auth' {
  interface AuthRequest {
    permissions?: PermissionMap;
  }
}

async function loadPermissions(req: AuthRequest): Promise<PermissionMap> {
  if (req.permissions) return req.permissions;
  if (!req.userId) return {};
  req.permissions = await resolveUserPermissions(req.userId);
  return req.permissions;
}

export function requirePermission(code: string, action: 'use' | 'input' = 'use') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const permissions = await loadPermissions(req);
      if (!hasPermission(permissions, code, action)) {
        res.status(403).json({ error: '権限がありません' });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: '権限の確認に失敗しました' });
    }
  };
}

export function requireAnyPermission(codes: string[], action: 'use' | 'input' = 'use') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const permissions = await loadPermissions(req);
      const allowed = codes.some((code) => hasPermission(permissions, code, action));
      if (!allowed) {
        res.status(403).json({ error: '権限がありません' });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: '権限の確認に失敗しました' });
    }
  };
}

export async function attachPermissions(req: AuthRequest): Promise<void> {
  if (req.userId && !req.permissions) {
    req.permissions = await resolveUserPermissions(req.userId);
  }
}
