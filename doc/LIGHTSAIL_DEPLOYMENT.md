# AWS Lightsail へのデプロイガイド

Frontend、Backend、PostgreSQL を同一サーバー内で動作させる場合の詳細なリリース手順

## 概要

本ガイドは、AWS Lightsail インスタンス上に以下を構築する方法を説明します：

- **Frontend (React + Vite)**: ポート 5173→ Nginx で 80/443 で公開
- **Backend (Node.js/Express)**: ポート 3000 (内部)
- **PostgreSQL**: ポート 5432 (内部のみ)
- **Nginx**: リバースプロキシ + SSL 終端
- **S3 Storage**: AWS S3 インテグレーション

---

## 1. Lightsail インスタンスの作成

### 1.1 インスタンスの起動

1. AWS マネジメントコンソール → **Lightsail** へアクセス
2. **インスタンスの作成** をクリック
3. 設定内容：
   - **ロケーション**: 適切なリージョン（例：東京 ap-northeast-1）
   - **イメージ**: `Ubuntu 22.04 LTS`
   - **プラン**: `中` または `大` を推奨（CPUとメモリ）
   - **インスタンス名**: `projecthub-prod` など
   - **Key ペア**: 新規作成またはダウンロード（*.pem ファイル）

4. **インスタンスを作成** をクリック

### 1.2 インスタンスへのアクセス

```bash
# ローカルマシンから SSH 接続
chmod 400 your_key.pem
ssh -i your_key.pem ubuntu@public-ip-address
```

---

## 2. サーバーの初期設定

### 2.1 システムアップデート

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl wget git
```

### 2.2 Docker & Docker Compose のインストール

```bash
# Docker リポジトリの追加
sudo apt-get install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker のインストール
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker グループに ubuntu ユーザーを追加
sudo usermod -aG docker ubuntu

# 新しいセッションを開くか、以下を実行
newgrp docker

# 確認
docker --version
docker compose version
```

### 2.3 Node.js のインストール（オプション、直接実行時用）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 3. リポジトリのクローン

```bash
# ホームディレクトリで作業
cd ~
git clone https://github.com/your-username/projecthub.git
cd projecthub
```

**または SSH キーを使用：**
```bash
git clone git@github.com:your-username/projecthub.git
```

---

## 4. 環境変数ファイルの設定

### 4.1 `.env` ファイルの作成

```bash
# プロジェクトルートディレクトリで
cat > .env << 'EOF'
# ========================================
# Data リューション Database
# ========================================
DATABASE_URL=postgresql://projecthub_user:secure_password_here@localhost:5432/projecthub_prod

# ========================================
# JWT Configuration
# ========================================
JWT_SECRET=$(openssl rand -base64 32)

# ========================================
# AWS S3 Configuration
# ========================================
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=projecthub-production-uploads
# AWS S3 を使用する場合は AWS_S3_ENDPOINT_URL は設定しない

# ========================================
# Application
# ========================================
NODE_ENV=production
BACKEND_PORT=3000
FRONTEND_PORT=5173
EOF
```

**注意**: 実際のアクセスキーを設定してください。

### 4.2 環境変数の確認

```bash
# セキュアな制限設定
chmod 600 .env
cat .env
```

---

## 5. PostgreSQL のセットアップ

### 5.1 Docker を使用したセットアップ

`docker-compose.yml` をの設定を確認し、本番環境用に調整してください：

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: projecthub-db
    environment:
      POSTGRES_USER: projecthub_user
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secure_password_here}
      POSTGRES_DB: projecthub_prod
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U projecthub_user"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

### 5.2 バックアップボリュームの設定

```bash
# ホストマシン上のバックアップディレクトリを作成
mkdir -p ~/projecthub-backups
chmod 700 ~/projecthub-backups
```

---

## 6. Docker Compose の設定

### 6.1 本番用 docker-compose.yml の確認

プロジェクトのメインディレクトリの `docker-compose.yml` を調整してください。

**重要な設定ポイント**:

```yaml
services:
  db:
    # ... PostgreSQL 設定 ...
    restart: always

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: projecthub-backend
    environment:
      DATABASE_URL: postgresql://projecthub_user:${DB_PASSWORD}@db:5432/projecthub_prod
      JWT_SECRET: ${JWT_SECRET}
      AWS_REGION: ${AWS_REGION}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      S3_BUCKET_NAME: ${S3_BUCKET_NAME}
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    restart: always
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: https://yourdomain.com/api
    container_name: projecthub-frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
    driver: local
```

### 6.2 環境変数を .env ファイルで管理

```bash
docker-compose --env-file .env up -d
```

---

## 7. Nginx リバースプロキシの設定

### 7.1 Nginx のインストール

```bash
sudo apt-get install -y nginx
```

### 7.2 Nginx 設定ファイルの作成

```bash
sudo tee /etc/nginx/sites-available/projecthub << 'EOF'
upstream backend {
    server 127.0.0.1:3000;
}

upstream frontend {
    server 127.0.0.1:5173;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 本番環境での自動リダイレクト (HTTPS へ)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 証明書設定
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL セッション設定
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # セキュリティヘッダー
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ログ設定
    access_log /var/log/nginx/projecthub_access.log;
    error_log /var/log/nginx/projecthub_error.log;

    # バックエンド API へのプロキシ
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # フロントエンド
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # キャッシュ設定（静的ファイル）
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 7.3 Nginx 設定を有効化

```bash
sudo ln -s /etc/nginx/sites-available/projecthub /etc/nginx/sites-enabled/projecthub

# デフォルト設定を無効化
sudo rm /etc/nginx/sites-enabled/default

# 設定ファイルの構文確認
sudo nginx -t

# Nginx を再起動
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## 8. SSL 証明書の設定（Let's Encrypt）

### 8.1 Certbot のインストール

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 8.2 SSL 証明書の取得

```bash
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com
```

### 8.3 自動更新の設定

```bash
# Certbot は自動更新するように既に設定されています
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 更新テスト
sudo certbot renew --dry-run
```

---

## 9. Lightsail ファイアウォール設定

### 9.1 インバウンドルールの設定

AWS Lightsail コンソールでファイアウォール設定を以下のように変更：

| プロトコル | ポート | 送信元 |
|----------|--------|--------|
| TCP | 22 | 自身の IP (SSH 用) |
| TCP | 80 | すべて (`0.0.0.0/0`) |
| TCP | 443 | すべて (`0.0.0.0/0`) |

**入力不要**:
- ポート 3000 (バックエンド): Nginx 経由でのみアクセス
- ポート 5432 (PostgreSQL): ローカルのみ
- ポート 5173 (フロントエンド): Nginx 経由でのみアクセス

---

## 10. S3 バケットの設定

### 10.1 AWS S3 バケットの作成

```bash
# AWS CLI で作成
aws s3 mb s3://projecthub-production-uploads --region ap-northeast-1
```

ブロックパブリックアクセス設定：

```bash
aws s3api put-public-access-block \
  --bucket projecthub-production-uploads \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 10.2 バケットポリシー設定

IAM ユーザーが必要な権限を持つことを確認：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::projecthub-production-uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::projecthub-production-uploads"
    }
  ]
}
```

---

## 11. アプリケーション起動

### 11.1 初回デプロイ

```bash
cd ~/projecthub

# Docker イメージのビルド
docker-compose build

# サービスの起動（バックグラウンド）
docker-compose up -d

# ログ確認
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### 11.2 データベースマイグレーション実行

```bash
# Prisma マイグレーション実行
docker-compose exec backend npx prisma db push --accept-data-loss

# データベースシーディング（初日）
docker-compose exec backend npx tsx ../prisma/seed.ts
```

### 11.3 ヘルスチェック

```bash
# バックエンド
curl -I http://localhost:3000/

# フロントエンド経由（Nginx 経由）
curl -I https://your-domain.com/

# Docker コンテナの状態確認
docker-compose ps
```

---

## 12. 運用・メンテナンス

### 12.1 ログの確認

```bash
# Docker ログの確認
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db

# Nginx ログの確認
sudo tail -f /var/log/nginx/projecthub_access.log
sudo tail -f /var/log/nginx/projecthub_error.log

# システムログ
sudo journalctl -u docker -f
```

### 12.2 リソース使用状況の確認

```bash
docker stats
```

### 12.3 バックアップ

**PostgreSQL バイナリバックアップ:**

```bash
# 手動バックアップ
docker-compose exec db pg_dump -U projecthub_user projecthub_prod > ~/projecthub-backups/backup-$(date +%Y%m%d-%H%M%S).sql

# 自動バックアップスクリプト（cron で実行）
# crontab -e で以下を追加（毎日 2:00 AM）
# 0 2 * * * docker-compose -f ~/projecthub/docker-compose.yml exec -T db pg_dump -U projecthub_user projecthub_prod > ~/projecthub-backups/backup-$(date +\%Y\%m\%d-\%H\%M\%S).sql
```

**S3 バケットのバックアップ:**

```bash
# S3 データをローカルにダウンロード
aws s3 sync s3://projecthub-production-uploads ~/projecthub-backups/s3-$(date +%Y%m%d)/
```

### 12.4 コンテナの更新

```bash
# 最新イメージをビルド
git pull origin main
docker-compose build

# コンテナを停止・削除・再起動
docker-compose down
docker-compose up -d

# ログ確認
docker-compose logs -f backend
```

### 12.5 環境変数の更新

```bash
# .env ファイルを編集
nano .env

# コンテナを再起動
docker-compose restart backend
docker-compose restart frontend
```

---

## 13. トラブルシューティング

### 13.1 コンテナが起動しない

```bash
# ログ確認
docker-compose logs backend

# コンテナの詳細情報
docker-compose ps
docker logs projecthub-backend
```

### 13.2 データベース接続エラー

```bash
# PostgreSQL への接続テスト
docker-compose exec db psql -U projecthub_user -d projecthub_prod -c "SELECT 1;"

# DATABASE_URL を確認
grep DATABASE_URL .env
```

### 13.3 S3 アップロードエラー

```bash
# AWS 認証情報の確認
grep AWS_ .env

# S3 バケットへのアクセステスト
aws s3 ls s3://projecthub-production-uploads

# IAM 権限の確認
aws iam get-user
aws iam list-user-policies --user-name your-username
```

### 13.4 Nginx エラー

```bash
# Nginx の構文チェック
sudo nginx -t

# Nginx を再読み込み
sudo systemctl reload nginx

# Nginx ログ確認
sudo tail -f /var/log/nginx/projecthub_error.log
```

### 13.5 SSL 証明書エラー

```bash
# 証明書の詳細確認
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout

# 証明書の有効期限を確認
sudo certbot certificates
```

---

## 14. セキュリティチェックリスト

本番環境を公開する前に以下を確認してください：

- [ ] **JWT_SECRET** が強力でランダムな値に変更されている
- [ ] **DATABASE_URL** が本番環境のデータベースを指している
- [ ] **AWS 認証情報** が最小限の権限を持つ IAM ユーザーのもの
- [ ] **Lightsail ファイアウォール** で不要なポートが閉じている
- [ ] **HTTPS/SSL** が有効で、HTTP は HTTPS にリダイレクト
- [ ] **PostgreSQL** がローカルのみでリッスン中（外部アクセス禁止）
- [ ] **自動バックアップ** が設定されている
- [ ] **ログ監視** が設定されている
- [ ] **Docker イメージ** に不要な内容が含まれていない
- [ ] **環境変数** が .gitignore に含まれている

---

## 15. 参考資料

- [AWS Lightsail ドキュメント](https://docs.aws.amazon.com/lightsail/)
- [Docker Compose リファレンス](https://docs.docker.com/compose/)
- [Nginx ドキュメント](https://nginx.org/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Prisma マイグレーション](https://www.prisma.io/docs/concepts/components/prisma-migrate)
