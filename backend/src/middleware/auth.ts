import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  isAdmin?: boolean;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string; isAdmin?: boolean };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.isAdmin = decoded.isAdmin;
    next();
  } catch {
    res.status(403).json({ error: 'トークンが無効です' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.isAdmin === false || (req.isAdmin === undefined && req.userRole !== 'admin')) {
    res.status(403).json({ error: '管理者権限が必要です' });
    return;
  }
  next();
}

export function generateToken(userId: number, role: string, isAdmin: boolean): string {
  return jwt.sign({ userId, role, isAdmin }, JWT_SECRET, { expiresIn: '7d' });
}
