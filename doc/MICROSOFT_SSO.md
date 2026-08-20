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

SSO のみなら既定の **Microsoft Graph** → `openid` / `profile` / `email`（委任）で足ります。追加の管理者同意は通常不要です（組織ポリシーによる）。

**Teams 個人通知**は Bot の 1:1 チャットへ投稿します（詳細は [§5 Teams 個人通知](#5-teams-個人通知bot-11)）。Graph のアプリケーション許可（`TeamsActivity.Send` 等）は不要です。同じ Entra アプリを **Azure Bot** として登録し、Developer Portal で Bot 付き Teams アプリを組織配布します。

---

## 3. ProjectHub 側の設定

### 3.1 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `MICROSOFT_TENANT_ID` | SSO 利用時 | ディレクトリ（テナント）ID |
| `MICROSOFT_CLIENT_ID` | SSO 利用時 | アプリケーション（クライアント）ID |
| `MICROSOFT_CLIENT_SECRET` | SSO 利用時 | クライアント シークレット |
| `MICROSOFT_REDIRECT_URI` | SSO 利用時 | Entra に登録したコールバック URL と **完全一致** |
| `FRONTEND_URL` | 推奨 | SSO 完了後のフロント URL（末尾スラッシュなし）。作業通知のディープリンク基点。未設定時は `http://localhost:5173` |
| `MICROSOFT_TEAMS_APP_ID` | 不要 | 旧アクティビティ通知用。設定しても Bot 送信では使わない |

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
| `admin.notification-settings` | 使用／入力（管理画面の既定配信先・テスト送信） |

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

## 5. Teams 個人通知（Bot 1:1）

チャンネル Webhook とアクティビティ フィード（`sendActivityNotification`）は使いません。**Bot の 1:1 チャット**に投稿します。ユーザーごとに別会話なので個人宛てです。履歴は Teams のチャットに残ります。

### 5.0 構成の全体像

| コンポーネント | 役割 | どこで設定するか |
|----------------|------|------------------|
| **Entra アプリ登録** | SSO と Bot 送信の共通 ID・シークレット | Microsoft Entra 管理センター |
| **Azure Bot** | 「この App ID は Bot として Teams に送れる」と Microsoft に登録 | Azure ポータル |
| **Teams アプリ（Developer Portal）** | 利用者の Teams に Bot 付きアプリを配布 | [Teams Developer Portal](https://dev.teams.microsoft.com/) |
| **ProjectHub backend** | 通知本文を Bot Framework Connector へ POST | `.env` + Docker |

メッセージの流れは **ProjectHub → Bot Framework（Azure Bot として登録した Entra アプリ）→ 利用者の Teams チャット** です。Developer Portal は配布用であり、メッセージの中継には入りません。

**ID の対応（混同しやすい点）**

| 名称 | 例（プレースホルダ） | 用途 |
|------|----------------------|------|
| Entra **クライアント ID** | `980eb92b-...` | SSO、`MICROSOFT_CLIENT_ID`、Azure Bot の Microsoft App ID、`bots.botId`、`webApplicationInfo.id` |
| Entra **テナント ID** | `86277f04-...` | `MICROSOFT_TENANT_ID`、Azure Bot の App Tenant ID |
| Teams **アプリ ID**（Developer Portal） | `d75c74a8-...` | マニフェストの `id`。Bot 送信では **使わない** |
| クライアント シークレット **値** | `.env` に保存 | `MICROSOFT_CLIENT_SECRET`。シークレット **ID**（GUID）ではない |

Graph のアプリケーション許可（`TeamsActivity.Send` 等）は **不要** です。

---

### 5.1 前提

- [§2 Entra ID](#2-entra-idazure側の設定) の SSO 用アプリ登録が済んでいること
- テストするユーザーが ProjectHub に存在し、**Microsoft アカウント連携**（`microsoftOid`）済みであること
- 受信者の Teams に Bot 付き ProjectHub アプリが **インストール済み** であること（未インストールでは 403）

---

### 5.2 Entra ID（既存アプリの確認）

1. [Microsoft Entra 管理センター](https://entra.microsoft.com/) → **アプリの登録** → ProjectHub（SSO 用）を開く
2. **概要**で次を控える（`.env` と一致させる）:
   - **アプリケーション（クライアント）ID** → `MICROSOFT_CLIENT_ID`
   - **ディレクトリ（テナント）ID** → `MICROSOFT_TENANT_ID`
3. **証明書とシークレット** → 有効なクライアント シークレットがあること  
   - `.env` の `MICROSOFT_CLIENT_SECRET` には作成時に表示された **値（Value）** を入れる  
   - 一覧の **シークレット ID**（例: `8b027481-...`）を入れると認証失敗になる
4. シークレットを作り直した場合のみ、新しい **値** を `.env` に反映し backend を再起動する

---

### 5.3 Azure Bot の作成・設定

Developer Portal だけでは Bot 送信はできません。**Azure ポータルで Azure Bot リソース**が必要です。

1. [Azure ポータル](https://portal.azure.com/) → **リソースの作成** → **Azure Bot**（または Bot Channels Registration）
2. **既存のアプリ登録を使用** を選び、§5.2 の **クライアント ID** を指定する（**新規アプリ登録は作らない**）
3. **種類 = 単一テナント（Single Tenant）**。App Tenant ID = `MICROSOFT_TENANT_ID`
4. 作成後、Bot リソース → **構成** で次を確認:
   - **Microsoft App ID** = `MICROSOFT_CLIENT_ID`
   - **App Tenant ID** = `MICROSOFT_TENANT_ID`
   - **App Type** = Single Tenant
5. **チャネル** → **Microsoft Teams** を開く  
   - **Messaging** タブ: 既定（Microsoft Teams Commercial）のままでよい  
   - **Calling** は変更不要  
   - 利用規約に同意し、画面下部の **[Apply]（適用）** を押して保存する（未 Apply だと 401 になる）
6. **メッセージング エンドポイント**  
   - 通知の **送信のみ**（ユーザーから Bot への返信を処理しない）なら **空で可**  
   - 入力必須と表示される場合はダミーの https URL を入れてもよいが、ProjectHub 側に受信 API はない

---

### 5.4 Teams Developer Portal（既存アプリの更新）

**アプリを削除して作り直す必要はありません。** 既存アプリのマニフェストを更新します。

#### A. GUI から更新（推奨）

JSON エディターと GUI の設定が衝突して壊れやすいため、**構成メニューから操作**するのが安全です。

1. [Teams Developer Portal](https://dev.teams.microsoft.com/) → 既存の ProjectHub アプリを開く
2. **構成 → アプリの機能 → Bot**
   - **Bot ID** = Entra の **クライアント ID**（`MICROSOFT_CLIENT_ID`）
   - **Scopes**: **Personal（個人）** にチェック（1:1 通知だけなら Personal のみで足りる）
   - 保存
3. **構成 → 基本情報**
   - **バージョン** を上げる（例: `1.0.0` → `1.1.0`）
   - 保存
4. **公開 → 組織に公開する** → **+ アプリの更新プログラムを送信する**

#### B. manifest.json を直接編集する場合

サンプル: [teams-app/manifest.json](teams-app/manifest.json)。ZIP に `color.png` / `outline.png` を同梱してアップロードします。

必須の要点:

- `id` = Developer Portal の **Teams アプリ ID**（Entra クライアント ID とは別）
- `bots[0].botId` と `webApplicationInfo.id` = Entra **クライアント ID**
- `version` を前回より大きくする
- Bot 1:1 のみなら `bots[0].scopes` は **`["personal"]` のみ**（推奨）

**マニフェスト検証でハマりやすい点**

| 症状 | 原因 | 対処 |
|------|------|------|
| `TeamsScopeMissingSupportChannelFeature` | `manifestVersion` 1.25 以上で `scopes` に `team` がある | `supportsChannelFeatures` を追加する **か** `scopes` から `team` / `groupChat` を外して **Personal のみ**にする（推奨） |
| `Property supportsChannelFeatures is not allowed` | `manifestVersion` が 1.11 等の旧版なのに `supportsChannelFeatures` を書いている | プロパティを削除する **か** `manifestVersion` を 1.25 以上に上げる |
| エディター上で JSON が壊れる | GUI 設定と JSON 直編集の衝突 | エディターを全消去して貼り直すより、§5.4 A の GUI 操作を優先 |

旧アクティビティ通知用の `activities` セクションは Bot 送信では **不要** です（残っていても動くが、新規更新時は削除してよい）。

`contentUrl` / `websiteUrl` を公開 https にすると、タブから ProjectHub を開けます。`example.com` のままでも **Bot 通知の送信・受信** は可能です。

---

### 5.5 Teams 管理センターでの承認

Developer Portal から「組織に公開」したあと、**Teams 管理センターへ反映されるまで数分〜十数分**かかることがあります。すぐ一覧に出なくても、反映待ちの可能性があります。

1. [Microsoft Teams 管理センター](https://admin.teams.microsoft.com/) → **Teams のアプリ** → **アプリの管理**
2. 画面上部の **「承認の保留中」**（更新されたカスタム アプリ）を確認する  
   - 一覧に出ない場合: 検索窓のフィルターを解除し、名前で `ProjectHub` を検索
3. 該当行を選択 → **[状態の編集]**（または **[承認]**）→ **許可** で保存

---

### 5.6 利用者側（Teams アプリの更新）

1. テストする本人の **Microsoft Teams** を開く
2. **アプリ** → **組織用に作成**（社内アプリ）→ **ProjectHub** を検索
3. **更新** が出れば更新。出なければ一度アンインストールして **追加**
4. **チャット** 一覧に **ProjectHub** との 1:1 チャット（Bot）が表示されることを確認

---

### 5.7 ProjectHub 側の反映とテスト

`.env`（Compose 用）例:

```bash
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your_client_secret_value   # シークレット ID ではない
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback
FRONTEND_URL=http://localhost:5173
```

変更後:

```bash
docker compose up -d --force-recreate backend
```

1. 管理画面 → **通知** タブ → **Teams テスト送信**
2. Teams の ProjectHub チャットに Adaptive Card 付きメッセージが届くこと
3. 本文に `FRONTEND_URL` のリンクが含まれること（https のとき「開く」ボタン付き）

未連携ユーザー、または Microsoft 設定未完了時は **メールへフォールバック** します。Bot API エラー時、通常の作業通知はログのみ、管理画面のテスト送信はエラー文言を返します。

---

### 5.8 トラブルシューティング

| 症状 | 確認・対処 |
|------|------------|
| `Bot Framework の認証に失敗しました` / `Authorization has been denied for this request` | Azure Bot が **同じクライアント ID** で作成されているか。Teams **チャネル** を Apply したか。`MICROSOFT_CLIENT_SECRET` が **値** か |
| 上記のあと `受信者に … Teams アプリ（Bot）がインストールされていません` | マニフェストに `bots` あり・組織公開・管理センター承認・本人 Teams でアプリ **更新** 済みか。チャット一覧に ProjectHub Bot があるか |
| 401 が Teams チャネル設定前だけ出ていた | チャネル未 Apply。§5.3 手順 5 |
| 管理センターに更新要求が出ない | Developer Portal 送信後 **数分〜十数分待つ**。§5.5 |
| タブだけ開きチャットに来ない | 旧アクティビティ通知用マニフェストのまま。`bots` 入りに更新・再配布 |
| SSO は動くが Bot だけ失敗 | Entra と Azure Bot の App ID 不一致、または Azure Bot 未作成 |

---

## 6. 関連ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| [backend/API_SPEC.md](backend/API_SPEC.md) | エンドポイント・解決ルール |
| [backend/DATA_MODEL.md](backend/DATA_MODEL.md) | User カラム・権限 code |
| [frontend/SCREENS_AND_ROUTES.md](frontend/SCREENS_AND_ROUTES.md) | Login / Settings 画面 |
| [LIGHTSAIL_DEPLOYMENT.md](LIGHTSAIL_DEPLOYMENT.md) | 本番環境変数・権限 seed |
