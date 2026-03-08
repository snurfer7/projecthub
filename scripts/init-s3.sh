#!/bin/bash

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
sleep 5

# Configure AWS CLI to use MinIO
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_DEFAULT_REGION=ap-northeast-1

# Create bucket if it doesn't exist
echo "Creating S3 bucket..."
aws s3 mb s3://redmine-uploads \
  --endpoint-url http://minio:9000 \
  --region ap-northeast-1 \
  2>/dev/null || true

echo "S3 bucket setup complete!"
echo "MinIO Console available at: http://localhost:9001"
echo "MinIO API available at: http://localhost:9000"
