import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

type OidcPending = {
  codeVerifier: string;
  nonce: string;
  mode: 'login' | 'link';
  userId?: number;
  createdAt: number;
};

type ExchangeEntry = {
  userId: number;
  createdAt: number;
};

const pendingStates = new Map<string, OidcPending>();
const exchangeCodes = new Map<string, ExchangeEntry>();

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (now - value.createdAt > STATE_TTL_MS) pendingStates.delete(key);
  }
  for (const [key, value] of exchangeCodes) {
    if (now - value.createdAt > EXCHANGE_TTL_MS) exchangeCodes.delete(key);
  }
}

export type MicrosoftOidcConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
};

export function getMicrosoftOidcConfig(): MicrosoftOidcConfig | null {
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim();
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
  if (!tenantId || !clientId || !clientSecret || !redirectUri) return null;
  if (tenantId === 'common' || tenantId === 'organizations' || tenantId === 'consumers') {
    return null;
  }
  return { tenantId, clientId, clientSecret, redirectUri, frontendUrl };
}

export function isMicrosoftSsoConfigured(): boolean {
  return getMicrosoftOidcConfig() !== null;
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function issuer(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

function authorizeEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
}

function tokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

function jwksUri(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
}

export function buildAuthorizationUrl(mode: 'login' | 'link', userId?: number): string {
  cleanupExpired();
  const config = getMicrosoftOidcConfig();
  if (!config) {
    throw new Error('Microsoft SSO is not configured');
  }
  if (mode === 'link' && userId == null) {
    throw new Error('userId is required for link mode');
  }

  const { verifier, challenge } = createPkcePair();
  const state = base64Url(crypto.randomBytes(24));
  const nonce = base64Url(crypto.randomBytes(24));
  pendingStates.set(state, {
    codeVerifier: verifier,
    nonce,
    mode,
    userId,
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${authorizeEndpoint(config.tenantId)}?${params.toString()}`;
}

export type MicrosoftIdClaims = {
  oid: string;
  tid: string;
  email: string | null;
  preferredUsername: string | null;
  givenName: string | null;
  familyName: string | null;
};

export type CallbackResult =
  | { ok: true; mode: 'login' | 'link'; claims: MicrosoftIdClaims; linkUserId?: number }
  | { ok: false; error: string };

export async function handleOidcCallback(query: {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}): Promise<CallbackResult> {
  cleanupExpired();
  if (query.error) {
    return { ok: false, error: query.error_description || query.error || 'Microsoft ログインに失敗しました' };
  }
  const code = query.code;
  const state = query.state;
  if (!code || !state) {
    return { ok: false, error: '不正なコールバックです' };
  }

  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending || Date.now() - pending.createdAt > STATE_TTL_MS) {
    return { ok: false, error: 'セッションの有効期限が切れました。再度お試しください' };
  }

  const config = getMicrosoftOidcConfig();
  if (!config) {
    return { ok: false, error: 'Microsoft SSO が設定されていません' };
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: pending.codeVerifier,
  });

  const tokenRes = await fetch(tokenEndpoint(config.tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error('Microsoft token exchange failed:', tokenRes.status, text);
    return { ok: false, error: 'Microsoft トークンの取得に失敗しました' };
  }

  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  if (!tokenJson.id_token) {
    return { ok: false, error: 'ID トークンが取得できませんでした' };
  }

  const JWKS = createRemoteJWKSet(new URL(jwksUri(config.tenantId)));
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(tokenJson.id_token, JWKS, {
      issuer: issuer(config.tenantId),
      audience: config.clientId,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (e) {
    console.error('Microsoft id_token verify failed:', e);
    return { ok: false, error: 'ID トークンの検証に失敗しました' };
  }

  if (typeof payload.nonce === 'string' && payload.nonce !== pending.nonce) {
    return { ok: false, error: '不正なトークンです' };
  }

  const oid = typeof payload.oid === 'string' ? payload.oid : null;
  const tid = typeof payload.tid === 'string' ? payload.tid : null;
  if (!oid || !tid) {
    return { ok: false, error: 'Microsoft ユーザー情報を取得できませんでした' };
  }
  if (tid !== config.tenantId) {
    return { ok: false, error: '許可されていないテナントです' };
  }

  const emailClaim =
    (typeof payload.email === 'string' && payload.email) ||
    (typeof payload.preferred_username === 'string' && payload.preferred_username.includes('@')
      ? payload.preferred_username
      : null);

  return {
    ok: true,
    mode: pending.mode,
    linkUserId: pending.userId,
    claims: {
      oid,
      tid,
      email: emailClaim ? emailClaim.trim().toLowerCase() : null,
      preferredUsername:
        typeof payload.preferred_username === 'string' ? payload.preferred_username : null,
      givenName: typeof payload.given_name === 'string' ? payload.given_name : null,
      familyName: typeof payload.family_name === 'string' ? payload.family_name : null,
    },
  };
}

export function createExchangeCode(userId: number): string {
  cleanupExpired();
  const code = base64Url(crypto.randomBytes(32));
  exchangeCodes.set(code, { userId, createdAt: Date.now() });
  return code;
}

export function consumeExchangeCode(code: string): number | null {
  cleanupExpired();
  const entry = exchangeCodes.get(code);
  exchangeCodes.delete(code);
  if (!entry || Date.now() - entry.createdAt > EXCHANGE_TTL_MS) return null;
  return entry.userId;
}

export function frontendLoginUrl(params: { ssoCode?: string; ssoError?: string }): string {
  const config = getMicrosoftOidcConfig();
  const base = config?.frontendUrl || 'http://localhost:5173';
  const q = new URLSearchParams();
  if (params.ssoCode) q.set('ssoCode', params.ssoCode);
  if (params.ssoError) q.set('ssoError', params.ssoError);
  const qs = q.toString();
  return qs ? `${base}/login?${qs}` : `${base}/login`;
}

export function frontendSettingsUrl(params?: { linked?: boolean; linkError?: string }): string {
  const config = getMicrosoftOidcConfig();
  const base = config?.frontendUrl || 'http://localhost:5173';
  const q = new URLSearchParams();
  if (params?.linked) q.set('microsoftLinked', '1');
  if (params?.linkError) q.set('microsoftLinkError', params.linkError);
  const qs = q.toString();
  return qs ? `${base}/settings?${qs}` : `${base}/settings`;
}
