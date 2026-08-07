import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticateToken, generateToken, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { assertFieldPermissions, resolveUserPermissions } from '../services/permissions';
import {
  buildAuthorizationUrl,
  consumeExchangeCode,
  createExchangeCode,
  frontendLoginUrl,
  frontendSettingsUrl,
  getMicrosoftOidcConfig,
  handleOidcCallback,
  isMicrosoftSsoConfigured,
  MicrosoftIdClaims,
} from '../services/microsoftOidc';
import { mergeUiPreferences, parseUiPreferences, type UserUiPreferences } from '../utils/uiPreferences';
import type { Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const authUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isAdmin: true,
  landingPage: true,
  showProjectsMenu: true,
  showGanttMenu: true,
  showCompanyMenu: true,
  showAdminMenu: true,
  status: true,
  authMethod: true,
  microsoftOid: true,
  uiPreferences: true,
} as const;

type AuthUserRow = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isAdmin: boolean;
  landingPage: string;
  showProjectsMenu: boolean;
  showGanttMenu: boolean;
  showCompanyMenu: boolean;
  showAdminMenu: boolean;
  status: string;
  authMethod: string;
  microsoftOid: string | null;
  uiPreferences?: Prisma.JsonValue | null;
};

function toPublicUser(user: AuthUserRow, permissions: Awaited<ReturnType<typeof resolveUserPermissions>>) {
  return {
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
    status: user.status,
    authMethod: user.authMethod,
    microsoftLinked: Boolean(user.microsoftOid),
    uiPreferences: parseUiPreferences(user.uiPreferences),
    permissions,
  };
}

async function loadAuthUser(userId: number): Promise<AuthUserRow | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: authUserSelect,
  });
}

async function syncEmailFromClaims(userId: number, claims: MicrosoftIdClaims): Promise<void> {
  if (!claims.email) return;
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!current || current.email.toLowerCase() === claims.email) return;
  const conflict = await prisma.user.findFirst({
    where: { email: { equals: claims.email, mode: 'insensitive' } },
  });
  if (conflict && conflict.id !== userId) return;
  await prisma.user.update({ where: { id: userId }, data: { email: claims.email } });
}

async function resolveSsoLoginUser(claims: MicrosoftIdClaims): Promise<{ user: AuthUserRow } | { error: string }> {
  const byOid = await prisma.user.findUnique({
    where: { microsoftOid: claims.oid },
    select: authUserSelect,
  });

  if (byOid) {
    if (byOid.authMethod !== 'sso') {
      return { error: 'このアカウントはパスワードログイン専用です。設定から認証方式を変更してください' };
    }
    if (byOid.status === 'inactive') {
      return { error: 'このアカウントは無効化されています' };
    }
    await syncEmailFromClaims(byOid.id, claims);
    if (byOid.status === 'pending') {
      await prisma.user.update({ where: { id: byOid.id }, data: { status: 'active' } });
    }
    const refreshed = await loadAuthUser(byOid.id);
    if (!refreshed) return { error: 'ユーザーが見つかりません' };
    return { user: refreshed };
  }

  if (!claims.email) {
    return {
      error:
        'Microsoft アカウントを ProjectHub ユーザーに連携できませんでした。パスワードでログインし、設定から連携してください',
    };
  }

  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: claims.email, mode: 'insensitive' } },
    select: authUserSelect,
  });

  if (!byEmail) {
    return { error: 'ProjectHub に登録されていないアカウントです。管理者にユーザー作成を依頼してください' };
  }
  if (byEmail.authMethod !== 'sso') {
    return {
      error:
        'このアカウントはパスワードログイン専用です。パスワードでログインし、設定から Microsoft 連携と認証方式の変更を行ってください',
    };
  }
  if (byEmail.status === 'inactive') {
    return { error: 'このアカウントは無効化されています' };
  }
  if (byEmail.microsoftOid && byEmail.microsoftOid !== claims.oid) {
    return { error: '別の Microsoft アカウントが既に連携されています' };
  }

  await prisma.user.update({
    where: { id: byEmail.id },
    data: {
      microsoftOid: claims.oid,
      microsoftTenantId: claims.tid,
      ...(byEmail.status === 'pending' ? { status: 'active' } : {}),
    },
  });
  const refreshed = await loadAuthUser(byEmail.id);
  if (!refreshed) return { error: 'ユーザーが見つかりません' };
  return { user: refreshed };
}

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const emailRaw = req.body?.email;
    const passwordRaw = req.body?.password;
    if (typeof emailRaw !== 'string' || typeof passwordRaw !== 'string') {
      res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
      return;
    }
    const email = emailRaw.trim();
    const password = passwordRaw;
    if (!email || !password) {
      res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    let passwordOk = false;
    try {
      passwordOk = await bcrypt.compare(password, user?.passwordHash ?? '');
    } catch {
      passwordOk = false;
    }
    if (!user || !passwordOk) {
      res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
      return;
    }
    if (user.status === 'inactive') {
      res.status(401).json({ error: 'このアカウントは無効化されています' });
      return;
    }
    if (user.authMethod === 'sso') {
      res.status(401).json({ error: 'このアカウントは Microsoft でログインしてください' });
      return;
    }
    const token = generateToken(user.id, user.role, user.isAdmin);
    const permissions = await resolveUserPermissions(user.id);
    res.json({
      token,
      user: toPublicUser(user, permissions),
    });
  } catch (e) {
    console.error('POST /auth/login:', e);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        ...authUserSelect,
        groupMembers: { select: { group: { select: { id: true, name: true } } } },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    const permissions = await resolveUserPermissions(req.userId!);
    const { microsoftOid, uiPreferences, ...rest } = user;
    res.json({
      ...rest,
      microsoftLinked: Boolean(microsoftOid),
      uiPreferences: parseUiPreferences(uiPreferences),
      permissions,
      // JWT には role / isAdmin が焼き込まれ最長 7 日更新されない。管理者への昇格・降格を
      // 次回リクエストへ反映するため、DB の最新値でトークンを再発行する。
      token: generateToken(user.id, user.role, user.isAdmin),
    });
  } catch (e) {
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

router.put('/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: '現在のパスワードと新しいパスワードを入力してください' });
      return;
    }
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
    if (user.authMethod === 'sso') {
      res.status(400).json({ error: 'SSO 利用中はパスワードを変更できません。認証方式をパスワードに戻してください' });
      return;
    }
    let valid = false;
    try {
      valid = await bcrypt.compare(currentPassword, user.passwordHash);
    } catch {
      valid = false;
    }
    if (!valid) {
      res.status(401).json({ error: '現在のパスワードが正しくありません' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        passwordHash,
        ...(user.status === 'pending' ? { status: 'active' } : {}),
      },
    });
    res.json({ message: 'パスワードを変更しました' });
  } catch (e) {
    res.status(500).json({ error: 'パスワードの変更に失敗しました' });
  }
});

router.put('/landing-page', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { landingPage } = req.body;
    if (!['home', 'projects', 'companies'].includes(landingPage)) {
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

router.put('/ui-preferences', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const patch = req.body?.uiPreferences;
    if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) {
      res.status(400).json({ error: 'uiPreferences オブジェクトを指定してください' });
      return;
    }
    const current = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { uiPreferences: true },
    });
    if (!current) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    const merged: UserUiPreferences = mergeUiPreferences(current.uiPreferences, patch);
    await prisma.user.update({
      where: { id: req.userId },
      data: { uiPreferences: merged as Prisma.InputJsonValue },
    });
    res.json({ message: '表示設定を更新しました', uiPreferences: merged });
  } catch (e) {
    console.error('Failed to update ui preferences:', e);
    res.status(500).json({ error: '表示設定の更新に失敗しました' });
  }
});

router.put(
  '/auth-method',
  authenticateToken,
  requirePermission('settings', 'use'),
  async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await resolveUserPermissions(req.userId!);
      const denied = assertFieldPermissions(permissions, req.body, {
        authMethod: 'settings.fields.authMethod',
      });
      if (denied) {
        res.status(403).json({ error: '権限がありません', code: denied });
        return;
      }

      const authMethod = req.body?.authMethod;
      if (authMethod !== 'password' && authMethod !== 'sso') {
        res.status(400).json({ error: '認証方式は password または sso を指定してください' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) {
        res.status(404).json({ error: 'ユーザーが見つかりません' });
        return;
      }

      if (authMethod === 'sso') {
        if (!user.microsoftOid) {
          res.status(400).json({ error: '先に Microsoft アカウントを連携してください' });
          return;
        }
        const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { authMethod: 'sso', passwordHash },
        });
        res.json({ message: '認証方式を Microsoft SSO に変更しました', authMethod: 'sso' });
        return;
      }

      const newPassword = req.body?.newPassword;
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        res.status(400).json({ error: 'パスワード認証に戻す場合は、6文字以上の新しいパスワードが必要です' });
        return;
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { authMethod: 'password', passwordHash },
      });
      res.json({ message: '認証方式をパスワードに変更しました', authMethod: 'password' });
    } catch (e) {
      console.error('PUT /auth/auth-method:', e);
      res.status(500).json({ error: '認証方式の更新に失敗しました' });
    }
  }
);

router.get('/microsoft/start', async (_req: AuthRequest, res: Response) => {
  try {
    if (!isMicrosoftSsoConfigured()) {
      res.redirect(frontendLoginUrl({ ssoError: 'Microsoft SSO が設定されていません' }));
      return;
    }
    const url = buildAuthorizationUrl('login');
    res.redirect(url);
  } catch (e) {
    console.error('GET /auth/microsoft/start:', e);
    res.redirect(frontendLoginUrl({ ssoError: 'Microsoft ログインの開始に失敗しました' }));
  }
});

router.get('/microsoft/callback', async (req: AuthRequest, res: Response) => {
  try {
    const result = await handleOidcCallback({
      code: typeof req.query.code === 'string' ? req.query.code : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      error_description:
        typeof req.query.error_description === 'string' ? req.query.error_description : undefined,
    });

    if (!result.ok) {
      if (result.error.includes('連携') || result.error.includes('設定')) {
        // fall through — login vs settings decided below after we know mode is lost on error
      }
      res.redirect(frontendLoginUrl({ ssoError: result.error }));
      return;
    }

    if (result.mode === 'link') {
      const linkUserId = result.linkUserId;
      if (linkUserId == null) {
        res.redirect(frontendSettingsUrl({ linkError: '連携セッションが無効です' }));
        return;
      }

      const existingOid = await prisma.user.findUnique({ where: { microsoftOid: result.claims.oid } });
      if (existingOid && existingOid.id !== linkUserId) {
        res.redirect(frontendSettingsUrl({ linkError: 'この Microsoft アカウントは別のユーザーに連携済みです' }));
        return;
      }

      const target = await prisma.user.findUnique({ where: { id: linkUserId } });
      if (!target) {
        res.redirect(frontendSettingsUrl({ linkError: 'ユーザーが見つかりません' }));
        return;
      }
      if (target.microsoftOid && target.microsoftOid !== result.claims.oid) {
        res.redirect(frontendSettingsUrl({ linkError: '既に別の Microsoft アカウントが連携されています。先に解除してください' }));
        return;
      }

      await prisma.user.update({
        where: { id: linkUserId },
        data: {
          microsoftOid: result.claims.oid,
          microsoftTenantId: result.claims.tid,
        },
      });
      res.redirect(frontendSettingsUrl({ linked: true }));
      return;
    }

    const resolved = await resolveSsoLoginUser(result.claims);
    if ('error' in resolved) {
      res.redirect(frontendLoginUrl({ ssoError: resolved.error }));
      return;
    }

    const code = createExchangeCode(resolved.user.id);
    res.redirect(frontendLoginUrl({ ssoCode: code }));
  } catch (e) {
    console.error('GET /auth/microsoft/callback:', e);
    res.redirect(frontendLoginUrl({ ssoError: 'Microsoft ログイン処理に失敗しました' }));
  }
});

router.post('/microsoft/exchange', async (req: AuthRequest, res: Response) => {
  try {
    const code = req.body?.code;
    if (typeof code !== 'string' || !code) {
      res.status(400).json({ error: 'コードが必要です' });
      return;
    }
    const userId = consumeExchangeCode(code);
    if (userId == null) {
      res.status(401).json({ error: 'コードが無効または期限切れです。再度ログインしてください' });
      return;
    }
    const user = await loadAuthUser(userId);
    if (!user) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    if (user.status === 'inactive') {
      res.status(401).json({ error: 'このアカウントは無効化されています' });
      return;
    }
    if (user.authMethod !== 'sso') {
      res.status(401).json({ error: 'このアカウントはパスワードログイン専用です' });
      return;
    }
    const token = generateToken(user.id, user.role, user.isAdmin);
    const permissions = await resolveUserPermissions(user.id);
    res.json({ token, user: toPublicUser(user, permissions) });
  } catch (e) {
    console.error('POST /auth/microsoft/exchange:', e);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

router.get(
  '/microsoft/link/start',
  authenticateToken,
  requirePermission('settings', 'use'),
  async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await resolveUserPermissions(req.userId!);
      const denied = assertFieldPermissions(
        permissions,
        { microsoftAccount: true },
        { microsoftAccount: 'settings.fields.microsoftAccount' }
      );
      if (denied) {
        res.status(403).json({ error: '権限がありません', code: denied });
        return;
      }
      if (!isMicrosoftSsoConfigured()) {
        res.status(503).json({ error: 'Microsoft SSO が設定されていません' });
        return;
      }
      const authorizationUrl = buildAuthorizationUrl('link', req.userId!);
      res.json({ authorizationUrl });
    } catch (e) {
      console.error('GET /auth/microsoft/link/start:', e);
      res.status(500).json({ error: 'Microsoft 連携の開始に失敗しました' });
    }
  }
);

router.post(
  '/microsoft/unlink',
  authenticateToken,
  requirePermission('settings', 'use'),
  async (req: AuthRequest, res: Response) => {
    try {
      const permissions = await resolveUserPermissions(req.userId!);
      const denied = assertFieldPermissions(
        permissions,
        { microsoftAccount: true },
        { microsoftAccount: 'settings.fields.microsoftAccount' }
      );
      if (denied) {
        res.status(403).json({ error: '権限がありません', code: denied });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) {
        res.status(404).json({ error: 'ユーザーが見つかりません' });
        return;
      }
      if (user.authMethod === 'sso') {
        res.status(400).json({ error: 'SSO 利用中は連携を解除できません。先に認証方式をパスワードに戻してください' });
        return;
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { microsoftOid: null, microsoftTenantId: null },
      });
      res.json({ message: 'Microsoft アカウントの連携を解除しました' });
    } catch (e) {
      console.error('POST /auth/microsoft/unlink:', e);
      res.status(500).json({ error: '連携解除に失敗しました' });
    }
  }
);

router.get('/microsoft/status', (_req: AuthRequest, res: Response) => {
  res.json({ enabled: isMicrosoftSsoConfigured(), configured: Boolean(getMicrosoftOidcConfig()) });
});

export default router;
