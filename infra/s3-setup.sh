#!/usr/bin/env bash
# Create the private bucket and apply CORS on Vultr Object Storage (section 14). Needs the AWS CLI.
#   S3_ENDPOINT=https://dfw1.vultrobjects.com S3_ACCESS_KEY=… S3_SECRET_KEY=… ./infra/s3-setup.sh
set -euo pipefail
export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY:?}" AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY:?}" AWS_DEFAULT_REGION="${S3_REGION:-us-east-1}"
BUCKET="${S3_BUCKET:-lore-media}"
aws --endpoint-url "${S3_ENDPOINT:?}" s3api create-bucket --bucket "$BUCKET" 2>/dev/null || true
aws --endpoint-url "$S3_ENDPOINT" s3api put-bucket-acl --bucket "$BUCKET" --acl private
aws --endpoint-url "$S3_ENDPOINT" s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$(dirname "$0")/s3-cors.json"
echo "bucket $BUCKET ready with CORS"
