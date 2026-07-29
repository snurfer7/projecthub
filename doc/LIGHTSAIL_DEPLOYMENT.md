# AWS Lightsail へのデプロイガイド

ローカルでビルドした成果物をサーバーにアップロードして運用する手順。

## アーキテクチャ概要

| コンポーネント | 方式 |
|---|---|
| Frontend (React + Vite) | ローカルビルド → `dist/` をアップロード → Nginx が静的配信 |
| Backend (Node.js/Express) | ローカルビルド → `dist/` をアップロード → PM2 で常駐起動 |
| PostgreSQL | サーバーに直接インストール（ポート 5432、内部のみ） |
| Nginx | 静的配信 + API リバースプロキシ + SSL 終端 |
| Amazon SES | メール送信（ユーザー作成通知など）。セクション 9 参照 |

---

## 1. デプロイスクリプトのセットアップ（ローカル）

### 1.1 設定ファイルを作成する

`scripts/deploy.conf.sample` をコピーして設定ファイルを作成します。  
`deploy.conf` は `.gitignore` により Git 管理対象外です。

```bash
cp scripts/deploy.conf.sample scripts/deploy.conf
```

`scripts/deploy.conf` を開いて、以下の 3 項目を環境に合わせて編集します。

| 変数 | 説明 |
|---|---|
| `SERVER_HOST` | Lightsail の Public IP アドレス |
| `SSH_KEY` | ダウンロードした `.pem` ファイルのパス |
| `VITE_API_URL` | 本番の API URL（例: `https://your-domain.example/api`） |

### 1.2 スクリプトの使い方

```bash
./scripts/deploy.sh [オプション]
```

| オプション | 動作 |
|---|---|
| （なし） | フロントエンド + バックエンド 全体デプロイ |
| `--backend-only` | バックエンドのみ |
| `--frontend-only` | フロントエンドのみ |
| `--skip-build` | ビルドをスキップしてアップロードのみ |
| `--skip-migrate` | DB マイグレーションをスキップ |
| `--seed` | 初回セットアップ用シード（管理者・マスタ・権限）を実行 |
| `--seed-perm` | 権限カタログのシードのみ実行 |

---

## 2. Lightsail インスタンスの作成

### 2.1 インスタンスの起動

1. AWS マネジメントコンソール → **Lightsail** へアクセス
2. **インスタンスの作成** をクリック
3. 設定：
   - **ロケーション**: 適切なリージョン（例: 東京 ap-northeast-1）
   - **イメージ**: `Ubuntu 22.04 LTS`
   - **プラン**: `中` または `大` を推奨
   - **Key ペア**: 新規作成またはダウンロード（`*.pem` ファイル）

### 2.2 ファイアウォール設定

Lightsail コンソールのネットワーキングタブで以下のように設定します。

| プロトコル | ポート | 送信元 |
|---|---|---|
| TCP | 22 | 自身の IP（SSH 用） |
| TCP | 80 | すべて（`0.0.0.0/0`） |
| TCP | 443 | すべて（`0.0.0.0/0`） |

外部に開放しないポート:
- 3000（バックエンド）: Nginx 経由のみ
- 5432（PostgreSQL）: ローカルのみ

---

## 3. サーバーの初期設定

SSH で接続して実行します。

```bash
chmod 400 your_key.pem
ssh -i your_key.pem ubuntu@<PUBLIC_IP>
```

### 3.1 システムアップデート

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget
```

### 3.2 Node.js（v20）のインストール

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version && npm --version
```

### 3.3 PM2 のインストール

```bash
sudo npm install -g pm2
```

### 3.4 PostgreSQL のインストールとセットアップ

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

データベースとユーザーを作成します。

```bash
sudo -u postgres psql << 'EOF'
CREATE USER projecthub_user WITH PASSWORD 'secure_password_here';
CREATE DATABASE projecthub_prod OWNER projecthub_user ENCODING 'UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE projecthub_prod TO projecthub_user;
EOF
```

PostgreSQL が localhost のみでリッスンしていることを確認します。

```bash
sudo grep listen_addresses /etc/postgresql/*/main/postgresql.conf
# listen_addresses = 'localhost' であればOK
```

### 3.5 Nginx のインストール

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
```

### 3.6 アプリ配置ディレクトリの作成

```bash
sudo mkdir -p /var/www/projecthub/frontend
sudo mkdir -p /var/www/projecthub/backend
sudo chown -R ubuntu:ubuntu /var/www/projecthub
```

---

## 4. サーバー側の環境変数設定

サーバーの `.env` ファイルは手動で作成します（機密情報のためスクリプトでは管理しません）。

```bash
cat > /var/www/projecthub/backend/.env << 'EOF'
# Database
DATABASE_URL=postgresql://projecthub_user:secure_password_here@localhost:5432/projecthub_prod

# JWT
JWT_SECRET=your_strong_random_secret_here

# Microsoft 365 / Entra ID SSO（利用する場合）
# MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# MICROSOFT_CLIENT_SECRET=your_client_secret
# MICROSOFT_REDIRECT_URI=https://your-domain.example/api/auth/microsoft/callback
# FRONTEND_URL=https://your-domain.example

# AWS
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=projecthub-production-uploads

# Amazon SES（セクション 9 を参照）
EMAIL_FROM=noreply@your-domain.example
# AWS_SES_ENDPOINT_URL= ← 本番 AWS SES では未設定のままにする

# Application
NODE_ENV=production
PORT=3000
EOF

chmod 600 /var/www/projecthub/backend/.env
```

---

## 4.1 Microsoft 365 SSO（Entra ID）の設定

パスワードログインに加え、Microsoft 365 による SSO を使う場合の手順です。**詳細な設定・ローカルテスト手順は [MICROSOFT_SSO.md](MICROSOFT_SSO.md) を参照**してください。

要点のみ:

- **自動プロビジョニングなし**（未登録ユーザーは SSO 不可）。メール不一致は設定画面からの明示連携
- Entra で単一テナントのアプリ登録、リダイレクト URI: `https://<公開ドメイン>/api/auth/microsoft/callback`
- 環境変数: `MICROSOFT_TENANT_ID` / `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_REDIRECT_URI` / `FRONTEND_URL`
- 権限 seed 後、`settings.fields.authMethod` / `settings.fields.microsoftAccount` に入力権限を付与

```bash
cd /var/www/projecthub/backend
npm run prisma:seed:permissions:prod
```

---

## 5. Nginx の設定

### 5.1 設定ファイルの作成

```bash
sudo tee /etc/nginx/sites-available/projecthub << 'EOF'
server {
    listen 80;
    server_name your-domain.example www.your-domain.example;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.example www.your-domain.example;

    ssl_certificate /etc/letsencrypt/live/your-domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.example/privkey.pem;

    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    access_log /var/log/nginx/projecthub_access.log;
    error_log /var/log/nginx/projecthub_error.log;

    # 添付ファイルは最大 50MB（multer 側の上限に合わせる）
    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    root /var/www/projecthub/frontend;
    index index.html;

    location = /favicon.ico {
        access_log off;
        log_not_found off;
        return 204;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 5.2 Nginx 設定を有効化

```bash
sudo ln -s /etc/nginx/sites-available/projecthub /etc/nginx/sites-enabled/projecthub
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. SSL 証明書の設定（Let's Encrypt）

```bash
sudo apt-get install -y certbot python3-certbot-nginx

# Nginx を停止してスタンドアロンモードで取得
sudo systemctl stop nginx
sudo certbot certonly --standalone -d your-domain.example
sudo systemctl restart nginx
```

自動更新の有効化:

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
sudo certbot renew --dry-run  # 更新テスト
```

---

## 7. 初回デプロイ（ローカルから実行）

サーバーの初期設定（セクション 3〜6）が完了したら、ローカルでスクリプトを実行します。

```bash
# 1. 設定ファイルを準備（未作成の場合）
cp scripts/deploy.conf.sample scripts/deploy.conf
# scripts/deploy.conf を編集

# 2. 初回デプロイ（シード込み）
./scripts/deploy.sh --seed
```

スクリプトは以下を自動で行います:
1. Backend / Frontend のビルド
2. rsync でサーバーへアップロード
3. サーバーで `npm install --omit=dev`
4. `npx prisma generate`（Prisma Client の生成）
5. `npx prisma migrate deploy`（DB マイグレーション）
6. `npm run prisma:seed:prod`（`--seed` 指定時のみ）
7. `pm2 restart`（または初回起動）

### 7.1 PM2 の自動起動設定（サーバーで1回だけ実行）

初回デプロイ後、サーバーで以下を実行します。

```bash
pm2 save
pm2 startup
# 出力されたコマンド（sudo env PATH=... など）を実行する
```

### 7.2 初回ログイン情報

`--seed` 実行後、以下の管理者アカウントでログインできます。  
**初回ログイン後、すぐにパスワードを変更してください。**

| 項目 | 値 |
|---|---|
| メールアドレス | `admin@example.com` |
| パスワード | `admin123` |

---

## 8. 更新デプロイ（通常運用）

コードを修正した後は、ローカルで実行します。

```bash
# 全体デプロイ（最も一般的）
./scripts/deploy.sh

# バックエンドのみ変更した場合
./scripts/deploy.sh --backend-only

# フロントエンドのみ変更した場合
./scripts/deploy.sh --frontend-only

# 権限カタログを追加・変更した場合（マイグレーション後に権限シードを再実行）
./scripts/deploy.sh --backend-only --seed-perm
```

---

## 9. Amazon SES（メール送信）の設定

バックエンドは `@aws-sdk/client-ses` でメールを送信します（例: ユーザー作成時の仮パスワード通知。本文のログイン URL は `FRONTEND_URL`）。

### 9.1 アプリ側の挙動

| 環境変数 | 役割 |
|---|---|
| `AWS_REGION` | SES クライアントのリージョン。検証した SES リージョンと一致させる |
| `EMAIL_FROM` | 送信元アドレス（未設定時: `noreply@projecthub.local`）。**SES で検証済みのアドレスまたはドメイン** |
| `FRONTEND_URL` | 案内メールに記載するログイン URL の基点（末尾スラッシュなし）。未設定時は `http://localhost:5173` |
| `AWS_SES_ENDPOINT_URL` | 本番 AWS SES では **未設定**（LocalStack 等の開発用のみ指定） |

### 9.2 SES で送信元を検証する

1. AWS コンソール → **Simple Email Service** を開く（`AWS_REGION` と同じリージョン）
2. **Verified identities** → **Create identity** を選択
3. 単一アドレスなら **Email address**、ドメイン全体なら **Domain** を選択
4. 検証が **Verified** になったら、サーバーの `.env` の `EMAIL_FROM` をそのアドレスに設定する

### 9.3 IAM に SES 送信権限を付与する

S3 用の IAM ユーザーに以下のポリシーを追加します。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

### 9.4 サンドボックスと本番送信

新規 SES アカウントは **サンドボックス** 状態で、検証済みアドレス宛てにしか送れません。  
任意の宛先へ送るには **Account dashboard** から **Request production access** を申請してください。

---

## 10. AWS S3 バケットの設定

### 10.1 バケットの作成

```bash
aws s3 mb s3://projecthub-production-uploads --region ap-northeast-1

aws s3api put-public-access-block \
  --bucket projecthub-production-uploads \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 10.2 IAM ユーザーポリシー

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::projecthub-production-uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::projecthub-production-uploads"
    }
  ]
}
```

---

## 11. 運用・メンテナンス

### バックエンドの状態確認

```bash
ssh -i your_key.pem ubuntu@<PUBLIC_IP>
pm2 status
pm2 logs projecthub-backend
```

### 環境変数の更新

```bash
nano /var/www/projecthub/backend/.env
pm2 restart projecthub-backend
```

### Nginx ログの確認

```bash
sudo tail -f /var/log/nginx/projecthub_access.log
sudo tail -f /var/log/nginx/projecthub_error.log
```

### PostgreSQL バックアップ

```bash
# 手動バックアップ
pg_dump -U projecthub_user -h localhost projecthub_prod \
  > ~/backups/backup-$(date +%Y%m%d-%H%M%S).sql

# 自動バックアップ（crontab -e で追加、毎日 2:00 AM）
# 0 2 * * * pg_dump -U projecthub_user -h localhost projecthub_prod > ~/backups/backup-$(date +\%Y\%m\%d).sql
```

---

## 12. トラブルシューティング

### バックエンドが起動しない

```bash
pm2 logs projecthub-backend --lines 50
pm2 show projecthub-backend
```

### `Cannot find module '.prisma/client/default'`（502 Bad Gateway）

Prisma Client が生成されていません。サーバーで実行してください。

```bash
cd /var/www/projecthub/backend
npx prisma generate
pm2 restart projecthub-backend
```

通常の更新デプロイ（`deploy.sh`）では自動で実行されます。

### データベース接続エラー

```bash
psql -U projecthub_user -h localhost -d projecthub_prod -c "SELECT 1;"
cat /var/www/projecthub/backend/.env | grep DATABASE_URL
```

### フロントエンドが表示されない

```bash
ls /var/www/projecthub/frontend/
sudo nginx -t
sudo tail -f /var/log/nginx/projecthub_error.log
```

### 413 Content Too Large

`client_max_body_size` が不足しています。

```bash
sudo nano /etc/nginx/sites-available/projecthub
# server ブロック内に追記: client_max_body_size 50M;
sudo nginx -t && sudo systemctl reload nginx
```

### SSL 証明書エラー

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### メールが送信されない（Amazon SES）

- `EMAIL_FROM` が SES の Verified identities と一致しているか
- `AWS_REGION` が SES コンソールで検証しているリージョンと同じか
- IAM に `ses:SendEmail` 権限があるか（セクション 9.3）
- サンドボックス状態の場合、宛先も検証済みアドレスか（セクション 9.4）
- `AWS_SES_ENDPOINT_URL` が本番環境に残っていないか（LocalStack 用設定）

```bash
pm2 logs projecthub-backend --lines 100
```

---

## 13. セキュリティチェックリスト

本番環境を公開する前に確認してください。

- [ ] **JWT_SECRET** が強力でランダムな値になっている
- [ ] **DATABASE_URL** のパスワードが変更されている
- [ ] **`.env` ファイル**のパーミッションが `600`（`chmod 600 .env`）
- [ ] **Microsoft SSO 利用時** `MICROSOFT_*` / `FRONTEND_URL` が設定され、Entra のリダイレクト URI と一致している
- [ ] **AWS 認証情報**が最小限の権限を持つ IAM ユーザーのもの
- [ ] **Lightsail ファイアウォール**で不要なポートが閉じている
- [ ] **HTTPS/SSL** が有効で、HTTP は HTTPS にリダイレクト
- [ ] **PostgreSQL** が localhost のみでリッスン中
- [ ] **自動バックアップ**が設定されている
- [ ] **`scripts/deploy.conf`** が `.gitignore` で管理対象外になっている
- [ ] **管理者アカウント**の初期パスワード（`admin123`）を変更済み
- [ ] **Amazon SES** の送信元が検証済みで、IAM に送信権限がある

---

## 参考資料

- [AWS Lightsail ドキュメント](https://docs.aws.amazon.com/lightsail/)
- [Amazon SES ドキュメント](https://docs.aws.amazon.com/ses/)
- [PM2 ドキュメント](https://pm2.keymetrics.io/docs/)
- [Nginx ドキュメント](https://nginx.org/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Prisma マイグレーション](https://www.prisma.io/docs/concepts/components/prisma-migrate)
