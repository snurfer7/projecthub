# ProjectHub

プロジェクト管理・時間追跡・ガントチャート・CRM機能を備えた統合型アプリケーション

## 開発環境でのセットアップ

```bash
docker-compose down && docker-compose build && docker-compose up -d
```

このコマンドで以下のサービスが起動します：
- **PostgreSQL**: ポート 5432
- **MinIO**: ポート 9000 (API) / 9001 (Console)
- **Backend**: ポート 3000
- **Frontend**: ポート 5173

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
# Docker コンテナ内でマイグレーション実行
docker-compose exec backend npx prisma db push --accept-data-loss
docker-compose exec backend npx tsx ../prisma/seed.ts
```

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

**コンテナが起動しない**
- Docker ログを確認: `docker-compose logs backend`
- 環境変数が設定されているか確認

## 関連ドキュメント

- [S3 File Storage Setup Guide](S3_SETUP.md): S3ストレージの詳細設定方法
- [AWS Lightsail へのデプロイガイド](doc/LIGHTSAIL_DEPLOYMENT.md): Lightsail上でのプロダクション環境構築手順（Frontend、Backend、PostgreSQL を同一サーバー内で動作させる場合）