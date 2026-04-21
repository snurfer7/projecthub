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
  let token = authHeader && authHeader.split(' ')[1];

  // Also support token in query parameter for direct browser downloads
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId?: unknown;
      role: string;
      isAdmin?: boolean;
    };
    // JWT のペイロードはクライアント次第で number / string になり得る。Prisma は Int 必須のため正規化する。
    const uid = Number(decoded.userId);
    if (
      decoded.userId === undefined ||
      decoded.userId === null ||
      Number.isNaN(uid) ||
      !Number.isInteger(uid) ||
      uid < 1
    ) {
      res.status(403).json({ error: 'トークンが無効です' });
      return;
    }
    req.userId = uid;
    req.userRole = decoded.role;
    req.isAdmin = decoded.isAdmin;
    next();
  } catch {
    res.status(403).json({ error: 'トークンが無効です' });
  }
}

export function generateDownloadToken(attachmentId: number, userId: number): string {
  return jwt.sign({ attachmentId, userId, purpose: 'download' }, JWT_SECRET, { expiresIn: '60s' });
}

export function verifyDownloadToken(token: string): { attachmentId: number; userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { attachmentId: number; userId: number; purpose: string };
    if (decoded.purpose !== 'download') return null;
    return { attachmentId: decoded.attachmentId, userId: decoded.userId };
  } catch {
    return null;
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
