# AWS Lightsail へのデプロイガイド

ローカルでビルドした成果物をサーバーにアップロードして運用する手順

## 概要

本ガイドは、ローカルマシンでビルドした成果物を AWS Lightsail インスタンスにアップロードして動作させる方法を説明します：

- **Frontend (React + Vite)**: ローカルでビルド → `dist/` をアップロード → Nginx が静的ファイルとして配信
- **Backend (Node.js/Express)**: ローカルでビルド → `dist/` をアップロード → PM2 で常駐起動
- **PostgreSQL**: サーバーに直接インストール（ポート 5432、内部のみ）
- **Nginx**: 静的ファイル配信 + API リバースプロキシ + SSL 終端

---

## 1. Lightsail インスタンスの作成

### 1.1 インスタンスの起動

1. AWS マネジメントコンソール → **Lightsail** へアクセス
2. **インスタンスの作成** をクリック
3. 設定内容：
   - **ロケーション**: 適切なリージョン（例：東京 ap-northeast-1）
   - **イメージ**: `Ubuntu 22.04 LTS`
   - **プラン**: `中` または `大` を推奨（CPU とメモリ）
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
sudo apt install -y curl wget
```

### 2.2 Node.js のインストール

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version
npm --version
```

### 2.3 PM2 のインストール

```bash
sudo npm install -g pm2
```

### 2.4 PostgreSQL のインストール

```bash
sudo apt-get install -y postgresql postgresql-contrib

# 起動・自動起動設定
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2.5 PostgreSQL のセットアップ

```bash
sudo -u postgres psql << 'EOF'
CREATE USER projecthub_user WITH PASSWORD 'secure_password_here';
CREATE DATABASE projecthub_prod OWNER projecthub_user ENCODING 'UTF8' LC_COLLATE='C' LC_CTYPE='C' TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE projecthub_prod TO projecthub_user;
EOF
```

PostgreSQL が外部からアクセスできないよう確認（デフォルトで localhost のみ）：

```bash
# postgresql.conf の listen_addresses が localhost であることを確認
sudo grep listen_addresses /etc/postgresql/*/main/postgresql.conf
```

### 2.6 Nginx のインストール

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
```

---

## 3. アップロード先ディレクトリの作成

```bash
# アプリケーション配置先
sudo mkdir -p /var/www/projecthub/frontend
sudo mkdir -p /var/www/projecthub/backend
sudo chown -R ubuntu:ubuntu /var/www/projecthub
```

---

## 4. 環境変数ファイルの設定（サーバー側）

```bash
cat > /var/www/projecthub/backend/.env << 'EOF'
# Database
DATABASE_URL=postgresql://projecthub_user:secure_password_here@localhost:5432/projecthub_prod

# JWT
JWT_SECRET=your_strong_random_secret_here

# AWS S3
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=projecthub-production-uploads

# Application
NODE_ENV=production
PORT=3000
EOF

chmod 600 /var/www/projecthub/backend/.env
```

---

## 5. ローカルでのビルド

ローカルマシン（開発環境）で実行します。

### 5.1 Backend のビルド

```bash
# プロジェクトルートで実行
cd backend
npm install
npm run build
# dist/ ディレクトリにコンパイル済み JS が生成される
```

### 5.2 Frontend のビルド

```bash
cd frontend
source ~/.bashrc  #シェルの設定を反映
npm install

# 本番環境の API URL を指定してビルド
VITE_API_URL=https://projecthub.nippoh.work/api npm run build
# dist/ ディレクトリに静的ファイルが生成される
```

---

## 6. サーバーへのアップロード

ローカルマシンで実行します。

### 6.1 Backend のアップロード

```bash
# ビルド成果物をアップロード
rsync -avz --delete \
  -e "ssh -i your_key.pem" \
  backend/dist/ \
  ubuntu@public-ip-address:/var/www/projecthub/backend/dist/

# package.json と package-lock.json をアップロード
scp -i your_key.pem \
  backend/package.json backend/package-lock.json \
  ubuntu@public-ip-address:/var/www/projecthub/backend/
```

### 6.2 Prisma スキーマのアップロード

```bash
rsync -avz \
  -e "ssh -i your_key.pem" \
  prisma/ \
  ubuntu@public-ip-address:/var/www/projecthub/prisma/
```

### 6.3 Frontend のアップロード

```bash
rsync -avz --delete \
  -e "ssh -i your_key.pem" \
  frontend/dist/ \
  ubuntu@public-ip-address:/var/www/projecthub/frontend/
```

---

## 7. サーバーでの初回セットアップ

SSH でサーバーに接続して実行します。

### 7.1 Backend の依存パッケージインストール

```bash
cd /var/www/projecthub/backend
npm install --omit=dev
```

### 7.2 データベースマイグレーション

```bash
cd /var/www/projecthub/backend
npx prisma db push
```

### 7.3 PM2 でバックエンドを起動

```bash
cd /var/www/projecthub/backend

pm2 start dist/index.js \
  --name projecthub-backend \
  --env production

# サーバー再起動時の自動起動設定
pm2 save
pm2 startup
# 表示されたコマンドを実行する（sudo env PATH=... など）
```

---

## 8. Nginx の設定

### 8.1 Nginx 設定ファイルの作成

```bash
sudo tee /etc/nginx/sites-available/projecthub << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 証明書設定
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

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

    access_log /var/log/nginx/projecthub_access.log;
    error_log /var/log/nginx/projecthub_error.log;

    # バックエンド API へのプロキシ
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # フロントエンド静的ファイル
    root /var/www/projecthub/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静的ファイルのキャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 8.2 Nginx 設定を有効化

```bash
sudo ln -s /etc/nginx/sites-available/projecthub /etc/nginx/sites-enabled/projecthub
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 9. SSL 証明書の設定（Let's Encrypt）

### 9.1 Certbot のインストール

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 9.2 SSL 証明書の取得

```bash
# Nginx を一時停止して証明書を取得
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com
```

### 9.3 自動更新の設定

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 更新テスト
sudo certbot renew --dry-run
```

---

## 10. Lightsail ファイアウォール設定

AWS Lightsail コンソールでファイアウォール設定を以下のように設定：

| プロトコル | ポート | 送信元 |
|----------|--------|--------|
| TCP | 22 | 自身の IP (SSH 用) |
| TCP | 80 | すべて (`0.0.0.0/0`) |
| TCP | 443 | すべて (`0.0.0.0/0`) |

**外部公開不要**:
- ポート 3000 (バックエンド): Nginx 経由でのみアクセス
- ポート 5432 (PostgreSQL): ローカルのみ

---

## 11. S3 バケットの設定

### 11.1 AWS S3 バケットの作成

```bash
aws s3 mb s3://projecthub-production-uploads --region ap-northeast-1

aws s3api put-public-access-block \
  --bucket projecthub-production-uploads \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 11.2 IAM ユーザーポリシー

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

## 12. 更新デプロイ手順

コードを修正した後の更新手順です。**ローカルマシンで実行**します。

### 12.1 ビルドと一括デプロイ（スクリプト例）

```bash
#!/bin/bash
# deploy.sh

SERVER="ubuntu@public-ip-address"
KEY="your_key.pem"
SSH="ssh -i $KEY"
SCP_OPTS="-i $KEY"

# Backend ビルド
echo "=== Backend ビルド ==="
cd backend
npm install
npm run build
cd ..

# Frontend ビルド
echo "=== Frontend ビルド ==="
cd frontend
VITE_API_URL=https://your-domain.com/api npm run build
cd ..

# Backend アップロード
echo "=== Backend アップロード ==="
rsync -avz --delete -e "ssh $SCP_OPTS" \
  backend/dist/ $SERVER:/var/www/projecthub/backend/dist/
scp $SCP_OPTS backend/package.json backend/package-lock.json \
  $SERVER:/var/www/projecthub/backend/

rsync -avz -e "ssh $SCP_OPTS" \
  prisma/ $SERVER:/var/www/projecthub/prisma/

# Frontend アップロード
echo "=== Frontend アップロード ==="
rsync -avz --delete -e "ssh $SCP_OPTS" \
  frontend/dist/ $SERVER:/var/www/projecthub/frontend/

# サーバーで依存関係インストール・マイグレーション・再起動
echo "=== サーバー更新 ==="
$SSH $SERVER << 'ENDSSH'
  cd /var/www/projecthub/backend
  npm install --omit=dev
  npx prisma db push
  pm2 restart projecthub-backend
ENDSSH

echo "=== デプロイ完了 ==="
```

```bash
chmod +x deploy.sh
./deploy.sh
```

### 12.2 個別に更新する場合

**Backend のみ更新:**

```bash
# ローカル: ビルド & アップロード
cd backend && npm run build && cd ..
rsync -avz --delete -e "ssh -i your_key.pem" \
  backend/dist/ ubuntu@public-ip-address:/var/www/projecthub/backend/dist/

# サーバー: 再起動
ssh -i your_key.pem ubuntu@public-ip-address "pm2 restart projecthub-backend"
```

**Frontend のみ更新:**

```bash
# ローカル: ビルド & アップロード（Nginx の再起動不要）
cd frontend && VITE_API_URL=https://your-domain.com/api npm run build && cd ..
rsync -avz --delete -e "ssh -i your_key.pem" \
  frontend/dist/ ubuntu@public-ip-address:/var/www/projecthub/frontend/
```

---

## 13. 運用・メンテナンス

### 13.1 バックエンドの状態確認

```bash
ssh -i your_key.pem ubuntu@public-ip-address
pm2 status
pm2 logs projecthub-backend
```

### 13.2 Nginx ログの確認

```bash
sudo tail -f /var/log/nginx/projecthub_access.log
sudo tail -f /var/log/nginx/projecthub_error.log
```

### 13.3 PostgreSQL バックアップ

```bash
# 手動バックアップ
pg_dump -U projecthub_user -h localhost projecthub_prod \
  > ~/backups/backup-$(date +%Y%m%d-%H%M%S).sql

# 自動バックアップ（crontab -e で追加、毎日 2:00 AM）
# 0 2 * * * pg_dump -U projecthub_user -h localhost projecthub_prod > ~/backups/backup-$(date +\%Y\%m\%d).sql
```

### 13.4 環境変数の更新

```bash
nano /var/www/projecthub/backend/.env
pm2 restart projecthub-backend
```

---

## 14. トラブルシューティング

### 14.1 バックエンドが起動しない

```bash
pm2 logs projecthub-backend --lines 50
pm2 show projecthub-backend
```

### 14.2 データベース接続エラー

```bash
# 接続テスト
psql -U projecthub_user -h localhost -d projecthub_prod -c "SELECT 1;"

# .env の DATABASE_URL を確認
cat /var/www/projecthub/backend/.env | grep DATABASE_URL
```

### 14.3 フロントエンドが表示されない

```bash
# ファイルが配置されているか確認
ls /var/www/projecthub/frontend/

# Nginx の設定・エラーログを確認
sudo nginx -t
sudo tail -f /var/log/nginx/projecthub_error.log
```

### 14.4 Nginx エラー

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 14.5 SSL 証明書エラー

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## 15. セキュリティチェックリスト

本番環境を公開する前に以下を確認してください：

- [ ] **JWT_SECRET** が強力でランダムな値に変更されている
- [ ] **DATABASE_URL** が本番環境のデータベースを指している
- [ ] **.env ファイル** のパーミッションが `600` に設定されている
- [ ] **AWS 認証情報** が最小限の権限を持つ IAM ユーザーのもの
- [ ] **Lightsail ファイアウォール** で不要なポートが閉じている
- [ ] **HTTPS/SSL** が有効で、HTTP は HTTPS にリダイレクト
- [ ] **PostgreSQL** が localhost のみでリッスン中（外部アクセス禁止）
- [ ] **自動バックアップ** が設定されている
- [ ] **環境変数** が .gitignore に含まれている

---

## 16. 参考資料

- [AWS Lightsail ドキュメント](https://docs.aws.amazon.com/lightsail/)
- [PM2 ドキュメント](https://pm2.keymetrics.io/docs/)
- [Nginx ドキュメント](https://nginx.org/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Prisma マイグレーション](https://www.prisma.io/docs/concepts/components/prisma-migrate)
