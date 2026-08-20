import { getMicrosoftOidcConfig } from '../microsoftOidc';
import { NotificationClientError } from './catalog';

type TokenCache = { accessToken: string; expiresAt: number };

const BOT_SERVICE_URL = (process.env.MICROSOFT_BOT_SERVICE_URL || 'https://smba.trafficmanager.net/teams/').replace(
  /\/?$/,
  '/'
);

let botTokenCache: TokenCache | null = null;
const conversationIdByOid = new Map<string, string>();

export function isTeamsBotConfigured(): boolean {
  return getMicrosoftOidcConfig() !== null;
}

async function getBotConnectorToken(): Promise<string> {
  const config = getMicrosoftOidcConfig();
  if (!config) {
    throw new Error('Microsoft Graph が未設定です');
  }
  const now = Date.now();
  if (botTokenCache && botTokenCache.expiresAt > now + 60_000) {
    return botTokenCache.accessToken;
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://api.botframework.com/.default',
  });
  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new NotificationClientError(
      json.error_description ||
        json.error ||
        `Bot Framework のトークン取得に失敗しました (${res.status})。Azure Bot（単一テナント）と Teams チャネルを確認してください。`
    );
  }
  const expiresIn = Number(json.expires_in) || 3600;
  botTokenCache = { accessToken: json.access_token, expiresAt: now + expiresIn * 1000 };
  return json.access_token;
}

async function connectorFetch(path: string, token: string, init: RequestInit): Promise<Response> {
  return fetch(`${BOT_SERVICE_URL}${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function createPersonalConversation(token: string, microsoftOid: string): Promise<string> {
  const cached = conversationIdByOid.get(microsoftOid);
  if (cached) return cached;
  const config = getMicrosoftOidcConfig()!;
  const res = await connectorFetch('v3/conversations', token, {
    method: 'POST',
    body: JSON.stringify({
      isGroup: false,
      bot: { id: config.clientId, name: 'ProjectHub' },
      members: [{ id: microsoftOid }],
      tenantId: config.tenantId,
      channelData: { tenant: { id: config.tenantId } },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throwBotError(res.status, text);
  }
  let parsed: { id?: string } = {};
  try {
    parsed = JSON.parse(text) as { id?: string };
  } catch {
    throw new Error(`Teams bot conversation create returned non-JSON: ${text}`);
  }
  if (!parsed.id) {
    throw new Error('Teams bot conversation id がありません');
  }
  conversationIdByOid.set(microsoftOid, parsed.id);
  return parsed.id;
}

function buildAdaptiveCard(title: string, preview: string, webUrl: string): Record<string, unknown> {
  const body: Record<string, unknown>[] = [
    { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true },
    { type: 'TextBlock', text: preview, wrap: true },
  ];
  const actions: Record<string, unknown>[] = [];
  if (/^https:\/\//i.test(webUrl)) {
    actions.push({ type: 'Action.OpenUrl', title: '開く', url: webUrl });
  } else if (webUrl.trim()) {
    body.push({ type: 'TextBlock', text: webUrl, wrap: true, isSubtle: true });
  }
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body,
    ...(actions.length ? { actions } : {}),
  };
}

export async function sendTeamsBotMessage(params: {
  microsoftOid: string;
  title: string;
  preview: string;
  webUrl: string;
}): Promise<void> {
  const config = getMicrosoftOidcConfig();
  if (!config) {
    throw new Error('Microsoft Graph が未設定です');
  }
  const token = await getBotConnectorToken();
  const conversationId = await createPersonalConversation(token, params.microsoftOid);
  const textLines = [params.title, params.preview, params.webUrl].filter(Boolean).join('\n\n');
  const res = await connectorFetch(`v3/conversations/${encodeURIComponent(conversationId)}/activities`, token, {
    method: 'POST',
    body: JSON.stringify({
      type: 'message',
      from: { id: config.clientId, name: 'ProjectHub' },
      conversation: { id: conversationId },
      recipient: { id: params.microsoftOid },
      text: textLines,
      textFormat: 'plain',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: buildAdaptiveCard(params.title, params.preview, params.webUrl),
        },
      ],
    }),
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 403) {
      conversationIdByOid.delete(params.microsoftOid);
    }
    throwBotError(res.status, await res.text());
  }
}

function throwBotError(status: number, body: string): never {
  let message = body;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    message = parsed.error?.message || parsed.message || body;
  } catch {
    message = body;
  }
  if (status === 403 || /ForbiddenOperationException|bot is not installed|not been installed/i.test(message)) {
    throw new NotificationClientError(
      '受信者に ProjectHub の Teams アプリ（Bot）がインストールされていません。マニフェストに bots を入れて再配布し、テストする Microsoft アカウントでアプリを更新してください。'
    );
  }
  if (status === 401) {
    const detail = message && message !== body ? message : body.slice(0, 300);
    throw new NotificationClientError(
      `Bot Framework の認証に失敗しました。Azure Bot の Microsoft App ID が Entra のクライアント ID（SSO と同じ）か、種類が単一テナントか、Teams チャネルが有効かを確認してください。詳細: ${detail}`
    );
  }
  throw new Error(`Teams bot message failed (${status}): ${body}`);
}
