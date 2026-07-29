# ProjectHub

プロジェクト管理・時間追跡・ガントチャート・CRM機能を備えた統合型アプリケーション

## 開発環境でのセットアップ

```bash
docker-compose down && docker-compose build && docker-compose up -d
```

このコマンドで以下のサービスが起動します：
- **PostgreSQL**: ポート 5432（ヘルスチェック後に接続可能とみなす）
- **migrate**: 同一イメージで **`prisma migrate deploy` のみ実行して終了**（`backend` より先。ボリュームを空にした直後も `up -d` だけでスキーマが揃う）
- **LocalStack** (S3 互換・ファイル添付 / SES モック): ポート 4566（`scripts/init-localstack.sh` で S3 バケット作成）
- **MinIO**（任意・S3 互換の別選択肢）: ポート 9000 (API) / 9001 (Console)。使う場合は `AWS_S3_ENDPOINT_URL=http://minio:9000` と MinIO 用の認証に上書き
- **Backend**: ポート 3000（既定で LocalStack S3 にファイルを保存）
- **Frontend**: ポート 5173

旧 CRM のデータ移行（`npm run migrate:legacy-crm`）は **ローカル DB 上でのみ**実行し、本番では実行しない想定です。本番への反映は DB・S3 を手動で持ち込みます（手順は [backend/migration/legacy-crm/README.md](backend/migration/legacy-crm/README.md) を参照）。

### メール送信のローカルテスト方法

ローカルでは **LocalStack の SES モック** に送信します。実際の受信箱には届きません。送信内容は LocalStack の履歴 API で確認します。

#### 前提

- `docker-compose up -d` で LocalStack が起動していること（起動時に `noreply@projecthub.local` が自動検証される）
- 管理画面の **メール設定** で送信方式が **SES**（既定）であること
- Compose 内の backend は `AWS_SES_ENDPOINT_URL=http://localstack:4566`（ホストから backend を直接動かす場合は `http://localhost:4566`）
- 送信元は環境変数 `EMAIL_FROM`（既定: `noreply@projecthub.local`）または管理画面の送信元上書き

#### 送信手順

1. フロントエンド（http://localhost:5173）にログインする（`admin.users` / `admin.email-settings` の input 権限が必要）
2. どちらかでメールを送る
   - **管理 → メール設定** → 宛先を入力して「テストメール送信」
   - **管理 → ユーザー** → ユーザー新規作成、または仮登録ユーザーの「登録メール再送」（仮パスワードが更新される）
3. UI で成功メッセージが出ること、または backend ログに `Email sent via SES to ...` が出ることを確認する

#### 送信内容の確認

ブラウザで http://localhost:4566/_aws/ses を開くか、次のコマンドで履歴（宛先・件名・本文）を取得します。

```bash
curl -s http://localhost:4566/_aws/ses
```

日本語が `\u30a2` のように Unicode エスケープされている場合は、次でデコードできます。

```bash
curl -s http://localhost:4566/_aws/ses | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
```

登録メールの件名は `[ProjectHub] アカウント作成のお知らせ` です。再送後は本文の仮パスワードが変わり、旧仮パスワードではログインできなくなります。

## 本番環境へのリリース方法

### 1. 前提条件

- Docker & Docker Compose がインストールされていること
- AWS S3 アカウント（またはS3互換ストレージ）があること
- PostgreSQL データベースがセットアップされていること
- 適切な環境変数が設定されていること

### 2. 環境変数の設定

本番環境用の `.env` ファイルを作成し、以下の環境変数を設定してください：

```env
# データベース設定
DATABASE_URL=postgresql://username:password@db-host:5432/production_db

# JWT設定 ⚠️ セキュアなシークレットに変更してください
JWT_SECRET=your-secure-jwt-secret-change-this-in-production

# AWS S3 設定
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=your-production-bucket-name
# AWS S3の場合は以下の行を削除またはコメントアウト
# AWS_S3_ENDPOINT_URL は設定しない（デフォルトでAWS S3を使用）

# AWS SES (メール送信用) 設定
EMAIL_FROM=noreply@your-domain.com
# 本番のAWS SESを使用する場合、以下の行は設定しない（デフォルトでAWS SESを使用）
# ローカルでテストする場合は `AWS_SES_ENDPOINT_URL=http://localstack:4566` とします。
# AWS_SES_ENDPOINT_URL=

# ポート設定（オプション）
BACKEND_PORT=3000
FRONTEND_PORT=80
```

### 3. データベースの準備

本番環境用のPostgreSQLデータベースを準備してください：

```bash
# AWS RDS、DigitalOcean、またはその他のマネージドサービスを使用することを推奨
# または、自身で管理するDB環境でデータベースを作成
createdb production_db
```

### 4. S3バケットの作成

AWS S3 でバケットを作成してください：

```bash
aws s3 mb s3://your-production-bucket-name --region ap-northeast-1
```

IAM権限の詳細は [S3_SETUP.md](S3_SETUP.md) を参照してください。

### 5. Docker イメージのビルド

```bash
# 本番用のイメージをビルド（環境変数を含める）
docker-compose -f docker-compose.yml build
```

### 6. 本番環境でのデプロイ

#### オプションA: Docker Compose を使用

```bash
# 環境変数を指定してサービスを起動
docker-compose -f docker-compose.yml up -d
```

#### オプションB: Kubernetes を使用

本番環境用の Kubernetes マニフェストファイルを作成し、デプロイしてください。

#### オプションC: クラウドプラットフォームの使用

- **AWS ECS/Fargate**: Docker イメージを ECR にプッシュし、ECS タスク定義を作成
- **Google Cloud Run**: Docker イメージをビルドして Cloud Run にデプロイ
- **DigitalOcean App Platform**: リポジトリを接続して自動デプロイ

### 7. データベースのマイグレーション実行

初回デプロイ時に、データベーススキーマを適用してください：

```bash
# Docker コンテナ内（作業ディレクトリは /app/backend）でマイグレーション実行
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx tsx ./prisma/seed.ts
```

> Prisma のスキーマはリポジトリ上 `backend/prisma/schema.prisma` にあります。`docker compose up` で起動する開発用スタックでは `start.sh` 内でも `migrate deploy` と seed が実行されるため、手動は本番用スタックなど必要な場合に限ります。

### 8. ヘルスチェック

デプロイ完了後、アプリケーションが正常に起動しているか確認してください：

```bash
# バックエンドのヘルスチェック
curl http://localhost:3000/

# フロントエンドへのアクセス
curl http://localhost:5173/
```

ブラウザでアクセス：
- **フロントエンド**: http://your-domain
- **バックエンド API**: http://your-api-domain:3000

### 9. 本番環境のセキュリティ設定

本番環境では以下の対策が必要です：

- **JWT_SECRET**: 強力でランダムなシークレットキーを生成してください
  ```bash
  openssl rand -base64 32
  ```
- **HTTPS/SSL**: 本番環境では必ずHTTPSを使用してください（リバースプロキシなので設定）
- **データベース**: マネージドサービス（AWS RDS等）の使用を推奨
- **ログ監視**: CloudWatch、Datadog等のログ監視ツールを設定
- **バックアップ**: 定期的なバックアップを設定

### 10. トラブルシューティング

**データベース接続エラー**
- `DATABASE_URL` が正しく設定されているか確認
- データベースサーバーがアクセス可能か確認

**S3 アップロードエラー**
- AWS認証情報が正しいか確認
- S3 バケット名と IAM 権限を確認
- AWS リージョン設定が正しいか確認

**メール送信 (SES) エラー**
- LocalStackまたはAWSの認証情報が正しいか確認
- 送信元アドレス (`EMAIL_FROM`) がSESで検証(Verify)済みであるか確認
- AWSリージョン設定が正しいか確認

**コンテナが起動しない**
- Docker ログを確認: `docker-compose logs backend`
- 環境変数が設定されているか確認

## 関連ドキュメント

- [S3 File Storage Setup Guide](S3_SETUP.md): S3ストレージの詳細設定方法
- [AWS Lightsail へのデプロイガイド](doc/LIGHTSAIL_DEPLOYMENT.md): Lightsail上でのプロダクション環境構築手順（Frontend、Backend、PostgreSQL を同一サーバー内で動作させる場合）
- [Microsoft 365 SSO 設定・ローカルテスト](doc/MICROSOFT_SSO.md): Entra ID アプリ登録、環境変数、ローカルでの確認手順