# S3 File Storage Setup Guide

このプロジェクトはAmazon S3またはS3互換サービス（MinIO）を使用してファイル保存を行います。

## 開発環境でのセットアップ（MinIO使用）

### 1. Docker Composeで起動

```bash
docker-compose up -d
```

このコマンドで以下のサービスが起動します：
- **PostgreSQL**: ポート 5432
- **MinIO**: ポート 9000 (API) / 9001 (Console)
- **Backend**: ポート 3000
- **Frontend**: ポート 5173

### 2. MinIO コンソールへのアクセス

ブラウザで以下のURLにアクセス：
```
http://localhost:9001
```

**ログイン情報:**
- ユーザー名: `minioadmin`
- パスワード: `minioadmin`

### 3. S3バケットの作成（自動）

MinIOが起動すると、自動的に `redmine-uploads` バケットが作成されます。

または、MinIOコンソールから手動で作成：
1. MinIOコンソール（http://localhost:9001）にログイン
2. 「Buckets」セクションから「Create Bucket」をクリック
3. バケット名に `redmine-uploads` を入力して作成

## 本番環境でのセットアップ（AWS S3使用）

### 1. 環境変数の設定

`.env` ファイルまたはDocker環境変数で以下を設定：

```env
# AWS S3 設定
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your-bucket-name
# AWS S3の場合は以下をコメントアウトまたは削除
# AWS_S3_ENDPOINT_URL=
```

### 2. S3バケットの作成

AWS マネジメントコンソールまたはAWS CLIで作成：

```bash
aws s3 mb s3://your-bucket-name --region ap-northeast-1
```

### 3. IAMロールの権限設定

以下の権限が必要なIAMユーザーまたはロール：

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
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name"
    }
  ]
}
```

## Docker環境変数

### バックエンドの環境変数

| 変数 | 説明 | デフォルト値 |
|------|------|----------|
| `AWS_REGION` | AWS リージョン | `ap-northeast-1` |
| `AWS_ACCESS_KEY_ID` | AWS アクセスキー | `minioadmin` |
| `AWS_SECRET_ACCESS_KEY` | AWS シークレットキー | `minioadmin` |
| `S3_BUCKET_NAME` | S3バケット名 | `redmine-uploads` |
| `AWS_S3_ENDPOINT_URL` | S3エンドポイント（MinIO使用時） | `http://minio:9000` |

### docker-compose.ymlでの使用例

```yaml
backend:
  environment:
    AWS_REGION: ap-northeast-1
    AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:-minioadmin}
    AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:-minioadmin}
    S3_BUCKET_NAME: ${S3_BUCKET_NAME:-redmine-uploads}
    # 開発環境（MinIO）用
    AWS_S3_ENDPOINT_URL: ${AWS_S3_ENDPOINT_URL:-http://minio:9000}
```

## ファイルアップロード機能

### アップロードエンドポイント

```
POST /api/attachments/upload
```

**リクエスト:**
- multipart/form-data
- フィールド:
  - `file`: アップロードするファイル
  - `projectId` (オプション): プロジェクトID
  - `issueId` (オプション): イシューID

**レスポンス:**
```json
{
  "id": 1,
  "filename": "example.pdf",
  "fileSize": 102400,
  "contentType": "application/pdf",
  "filePath": "uploads/1234567890-example.pdf",
  "projectId": 1,
  "issueId": null,
  "authorId": 1,
  "createdAt": "2026-03-05T10:00:00Z",
  "author": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### ダウンロードエンドポイント

```
GET /api/attachments/download/:id
```

署名付きURLが返され、現在のS3ファイルをダウンロードできます。

**レスポンス:**
```json
{
  "url": "https://redmine-uploads.s3.ap-northeast-1.amazonaws.com/uploads/...",
  "filename": "example.pdf"
}
```

### 削除エンドポイント

```
DELETE /api/attachments/:id
```

S3からファイルを削除し、データベースレコードも削除します。

## トラブルシューティング

### MinIOに接続できない

```
Error: Unable to reach MinIO
```

**解決方法:**
1. MinIOコンテナが起動しているか確認: `docker ps`
2. ログを確認: `docker logs <minio_container_name>`
3. 5秒待ってから再度接続を試す（起動に時間がかかる場合）

### バケットが見つからない

```
Error: NoSuchBucket
```

**解決方法:**
1. MinIOコンソールでバケットが作成されているか確認
2. 手動でバケット作成: MinIOコンソール → Buckets → Create Bucket
3. バケット名が環境変数の `S3_BUCKET_NAME` と一致しているか確認

### AWS S3接続エラー

```
Error: Invalid credentials
```

**解決方法:**
1. AWS credentials が正しいか確認
2. `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` が正しく設定されているか確認
3. IAM権限が正しく設定されているか確認
4. AWS_REGIONが正しいか確認

## ファイルサイズ制限

現在のデフォルトは **50MB** です。

変更する場合は `backend/src/routes/attachments.ts` を修正：

```typescript
const upload = multer({ 
  storage, 
  limits: { fileSize: 100 * 1024 * 1024 } // 100MBに変更
});
```

## セキュリティに関する注意

1. **本番環境では必ずAWS S3を使用してください** - MinIOは開発環境用です
2. **AWS認証情報を公開しないでください** - 環境変数で管理してください
3. **IAM権限は最小限に** - 必要な権限のみを設定してください
4. **S3バケットの公開設定を確認してください** - セキュリティ設定を確認しましょう
