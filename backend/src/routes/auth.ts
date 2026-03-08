import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticateToken, generateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
      return;
    }
    const token = generateToken(user.id, user.role, user.isAdmin);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isAdmin: user.isAdmin,
        landingPage: user.landingPage,
        showProjectsMenu: user.showProjectsMenu,
        showGanttMenu: user.showGanttMenu,
        showCompanyMenu: user.showCompanyMenu,
        showAdminMenu: user.showAdminMenu,
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName },
    });
    const token = generateToken(user.id, user.role, user.isAdmin);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isAdmin: user.isAdmin,
        landingPage: user.landingPage,
        showProjectsMenu: user.showProjectsMenu,
        showGanttMenu: user.showGanttMenu,
        showCompanyMenu: user.showCompanyMenu,
        showAdminMenu: user.showAdminMenu,
      },
    });
  } catch (e) {
    res.status(500).json({ error: '登録に失敗しました' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, isAdmin: true, landingPage: true,
        showProjectsMenu: true, showGanttMenu: true, showCompanyMenu: true, showAdminMenu: true
      },
    });
    if (!user) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

router.put('/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: '現在のパスワードと新しいパスワードを入力してください' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: '新しいパスワードは6文字以上で入力してください' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: '現在のパスワードが正しくありません' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
    res.json({ message: 'パスワードを変更しました' });
  } catch (e) {
    res.status(500).json({ error: 'パスワードの変更に失敗しました' });
  }
});

router.put('/landing-page', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { landingPage } = req.body;
    if (!['home', 'projects', 'gantt', 'companies'].includes(landingPage)) {
      res.status(400).json({ error: '無効な遷移先です' });
      return;
    }
    await prisma.user.update({
      where: { id: req.userId },
      data: { landingPage },
    });
    res.json({ message: '遷移先の設定を更新しました', landingPage });
  } catch (e) {
    console.error('Failed to update landing page:', e);
    res.status(500).json({ error: '設定の更新に失敗しました' });
  }
});

router.put('/menu-settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { showProjectsMenu, showGanttMenu, showCompanyMenu, showAdminMenu } = req.body;
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(showProjectsMenu !== undefined && { showProjectsMenu }),
        ...(showGanttMenu !== undefined && { showGanttMenu }),
        ...(showCompanyMenu !== undefined && { showCompanyMenu }),
        ...(showAdminMenu !== undefined && { showAdminMenu }),
      },
    });
    res.json({ message: 'メニュー表示設定を更新しました' });
  } catch (e) {
    console.error('Failed to update menu settings:', e);
    res.status(500).json({ error: 'メニュー表示設定の更新に失敗しました' });
  }
});

export default router;
