#!/bin/bash

BUCKET="${S3_BUCKET_NAME:-redmine-uploads}"

echo "Initializing LocalStack S3..."
if awslocal s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "Bucket ${BUCKET} already exists."
else
  awslocal s3 mb "s3://${BUCKET}"
  echo "Created bucket ${BUCKET}."
fi

echo "Initializing LocalStack SES..."
awslocal ses verify-email-identity --email-address noreply@projecthub.local
awslocal ses verify-domain-identity --domain projecthub.local
echo "LocalStack S3 / SES initialization completed."
