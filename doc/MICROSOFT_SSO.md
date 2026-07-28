# Microsoft 365 SSO 設定・ローカルテスト

Web 向け Microsoft Entra ID（Microsoft 365）SSO の設定手順と、ローカル環境での確認方法です。

- **対象**: Web のみ（Android は非対応）
- **自動プロビジョニング**: なし（未登録ユーザーは SSO 不可）
- **API 契約**: [backend/API_SPEC.md](backend/API_SPEC.md) の `/api/auth`
- **本番デプロイ時の要点**: [LIGHTSAIL_DEPLOYMENT.md](LIGHTSAIL_DEPLOYMENT.md) の「4.1 Microsoft 365 SSO」

---

## 1. 動作の概要

| 項目 | 内容 |
|------|------|
| 認証方式 | ユーザーごとに `password`（パスワードのみ）または `sso`（Microsoft のみ） |
| 紐付けキー | Entra の object id（`microsoftOid`）。UPN / ドメイン変更後も継続 |
| メール同期 | oid 一致の SSO 成功時、`User.email` を Entra のログイン ID（UPN = `preferred_username`）へ自動更新。他ユーザーと衝突時はスキップ。ProjectHub の表示メールを `@nippoh.jp` 等にしたい場合は Entra 側の UPN をそのドメインにする |
| メール不一致 | 未連携時の SSO はメール一致が必要。不一致はパスワードで入り、設定から明示連携すれば可 |
| ログインボタン | 環境変数が揃っているときのみ「Microsoft でログイン」を表示 |

### 推奨ユーザーフロー

1. 管理者が ProjectHub にユーザーを作成（従来どおり）
2. ユーザーが **パスワードでログイン**
3. **設定** → Microsoft アカウントを連携
4. **設定** → 認証方式を「Microsoft SSO のみ」に変更
5. 以降はログイン画面の「Microsoft でログイン」を使用

メールアドレスが ProjectHub と Microsoft で一致し、かつ既に `authMethod=sso` の場合は、未連携でも初回 SSO 時に `oid` を保存してログインできます。

---

## 2. Entra ID（Azure）側の設定

### 2.1 アプリの登録

1. [Azure ポータル](https://portal.azure.com/) → **Microsoft Entra ID** → **アプリの登録** → **新規登録**
2. 名前: 例 `ProjectHub`
3. サポートされているアカウントの種類: **この組織ディレクトリのみ（単一テナント）**
4. リダイレクト URI:
   - プラットフォーム: **Web**
   - URI（ローカル）: `http://localhost:3000/api/auth/microsoft/callback`
   - URI（本番）: `https://<公開ドメイン>/api/auth/microsoft/callback`
5. 登録後、概要から次を控える:
   - **アプリケーション（クライアント）ID** → `MICROSOFT_CLIENT_ID`
   - **ディレクトリ（テナント）ID** → `MICROSOFT_TENANT_ID`（`common` / `organizations` は不可）

ローカルと本番で URI が違う場合は、同一アプリに **両方のリダイレクト URI を追加**して構いません。

### 2.2 クライアント シークレット

1. アプリ → **証明書とシークレット** → **新しいクライアント シークレット**
2. 説明・有効期限を設定し作成
3. **値**（一度しか表示されない）を控える → `MICROSOFT_CLIENT_SECRET`

### 2.3 トークン（推奨確認）

1. アプリ → **認証**
2. **ID トークン**（暗黙的およびハイブリッド フローで使用される）にチェックが入っていることを確認  
   （本実装は Authorization Code + PKCE のため必須ではないが、テナント設定によっては有用）
3. フロントチャネル ログアウト等は不要

### 2.4 API のアクセス許可

既定の **Microsoft Graph** → `openid` / `profile` / `email`（委任）で足ります。追加の管理者同意は通常不要です（組織ポリシーによる）。

---

## 3. ProjectHub 側の設定

### 3.1 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `MICROSOFT_TENANT_ID` | SSO 利用時 | ディレクトリ（テナント）ID |
| `MICROSOFT_CLIENT_ID` | SSO 利用時 | アプリケーション（クライアント）ID |
| `MICROSOFT_CLIENT_SECRET` | SSO 利用時 | クライアント シークレット |
| `MICROSOFT_REDIRECT_URI` | SSO 利用時 | Entra に登録したコールバック URL と **完全一致** |
| `FRONTEND_URL` | 推奨 | SSO 完了後のフロント URL（末尾スラッシュなし）。未設定時は `http://localhost:5173` |

未設定（いずれか欠落）の場合、SSO は無効です。ログイン画面に Microsoft ボタンは出ず、パスワードログインのみになります。

設定例はリポジトリ直下の [`.env.example`](../.env.example) を参照してください。

### 3.2 データベース・権限

初回または SSO 機能追加後:

```bash
# マイグレーション（auth_method / microsoft_oid 等）
cd backend
npx prisma migrate deploy --schema ./prisma/schema.prisma

# 権限カタログに settings.fields.* を反映
npm run prisma:seed:permissions   # ローカル（tsx）
# 本番: npm run build 後に npm run prisma:seed:permissions:prod
```

管理画面 → **権限設定** で、対象グループの PermissionSet に次を付与します。

| code | 必要な権限 |
|------|------------|
| `settings` | 使用（設定画面） |
| `settings.fields.authMethod` | **入力**（認証方式の変更） |
| `settings.fields.microsoftAccount` | **入力**（Microsoft 連携・解除） |

カタログだけ seed しても、既存の権限設定マトリクスには自動では付与されません。管理者によるチェックが必要です。

### 3.3 本番での再起動

環境変数変更後は backend を再起動してください（例: `pm2 restart projecthub-backend`）。詳細は [LIGHTSAIL_DEPLOYMENT.md](LIGHTSAIL_DEPLOYMENT.md) を参照。

---

## 4. ローカルでのテスト方法

### 4.1 前提

- Docker Compose で開発環境を起動できること（[README.md](../README.md)）
- テスト用 Microsoft 365 / Entra ユーザー（自社テナント）を用意できること
- ProjectHub に、そのユーザーと対応するアカウントが既に存在すること（管理者作成）

### 4.2 環境変数の入れ方（Docker Compose）

プロジェクトルートの `.env`（Compose が変数展開に使う）に設定します。

```bash
# 例: リポジトリルートの .env
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback
FRONTEND_URL=http://localhost:5173
```

`docker-compose.yml` の backend サービスが上記を読み込みます。変更後:

```bash
docker-compose up -d --force-recreate backend
```

ホストで backend だけ動かす場合は、同じ変数をプロセス環境に渡してください（`backend/.env` を Prisma 以外が自動読込する保証はないため、Compose 利用を推奨）。

### 4.3 Entra のローカル用リダイレクト URI

アプリ登録のリダイレクト URI に次を追加します。

```text
http://localhost:3000/api/auth/microsoft/callback
```

ブラウザはフロント（`http://localhost:5173`）から `/api/...` をプロキシしますが、**Entra からの戻り先は backend の 3000 番**（上記）にします。コールバック後、backend が `FRONTEND_URL`（5173）の `/login` または `/settings` へリダイレクトします。

### 4.4 起動と疎通確認

```bash
docker-compose up -d
```

- フロント: http://localhost:5173  
- API: http://localhost:3000  

SSO が有効か確認:

```bash
curl -s http://localhost:3000/api/auth/microsoft/status
# 期待: {"enabled":true,"configured":true}
```

`enabled: false` のときは環境変数の欠落・空文字・`TENANT_ID=common` などを見直してください。

### 4.5 テスト手順 A: 明示連携（メール不一致でも可）

1. 管理画面でテスト用ユーザーを作成（仮パスワード）。必要なら権限で `settings` / 上記 field の入力を付与
2. http://localhost:5173/login で **パスワードログイン**
3. **設定** を開く
4. 「Microsoft アカウントを連携」→ Entra のログイン画面 → 許可
5. `/settings?microsoftLinked=1` に戻り「連携済み」になること
6. 「認証方式」で **Microsoft SSO のみ** を選び保存
7. ログアウト
8. ログイン画面に「Microsoft でログイン」が出ていること
9. クリックし、同じ Microsoft アカウントでログインできること
10. パスワードフォームではログインできないこと（案内メッセージ）

### 4.6 テスト手順 B: メール一致 + 既に SSO 方式

1. ProjectHub のユーザー `email` と Microsoft のサインインメール（UPN）を一致させる
2. DB または設定で `authMethod` を `sso` にする（未連携でも可）
3. 「Microsoft でログイン」だけで入れること（初回で `microsoftOid` が保存される）

### 4.7 拒否系の確認（受け入れ条件）

| 条件 | 期待結果 |
|------|----------|
| ProjectHub にユーザーがいない | SSO 失敗。アカウントは作られない |
| メール不一致かつ未連携 | SSO 失敗。パスワード＋明示連携を案内 |
| `authMethod=password` のまま Microsoft ボタン | SSO 失敗（パスワード専用） |
| `authMethod=sso` でパスワードログイン | 401（Microsoft を使うよう案内） |
| SSO 利用中に連携解除 | 不可（先に password へ戻す必要あり） |

### 4.8 よくある失敗

| 症状 | 確認ポイント |
|------|----------------|
| ログインが 500 / API が応答しない | backend ログに `Cannot find module 'jose'` 等がないか。依存追加後は `docker compose up -d --build backend` でイメージ再ビルド |
| Microsoft ボタンが出ない | `GET /api/auth/microsoft/status` が `enabled:true` か。Compose 再作成したか |
| `AADSTS50011`（redirect URI） | Entra の URI と `MICROSOFT_REDIRECT_URI` が一字一句一致しているか（http/https、ポート、パス） |
| コールバック後すぐエラー | `FRONTEND_URL` が `http://localhost:5173` になっているか。backend ログ |
| 設定に連携 UI が無い / 押せない | SSO 環境変数、および `settings.fields.microsoftAccount` の **入力** 権限 |
| 連携はできたが SSO できない | 認証方式がまだ `password` のままになっていないか |

---

## 5. 関連ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| [backend/API_SPEC.md](backend/API_SPEC.md) | エンドポイント・解決ルール |
| [backend/DATA_MODEL.md](backend/DATA_MODEL.md) | User カラム・権限 code |
| [frontend/SCREENS_AND_ROUTES.md](frontend/SCREENS_AND_ROUTES.md) | Login / Settings 画面 |
| [LIGHTSAIL_DEPLOYMENT.md](LIGHTSAIL_DEPLOYMENT.md) | 本番環境変数・権限 seed |
