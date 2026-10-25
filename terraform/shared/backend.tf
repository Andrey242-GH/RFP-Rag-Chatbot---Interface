# ---------------------------------------------------------------------------
# Remote State Backend Bootstrap
#
# This file documents the S3 + DynamoDB backend that EACH environment
# configures in its own backend.tf.  The bucket and lock table are created
# once (manually or via the bootstrap script) and are shared across all
# workspaces.
#
# To bootstrap (run once per AWS account):
#
#   aws s3api create-bucket \
#     --bucket rfp-platform-tfstate-<account_id> \
#     --region us-east-1
#
#   aws s3api put-bucket-versioning \
#     --bucket rfp-platform-tfstate-<account_id> \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-server-side-encryption-configuration \
#     --bucket rfp-platform-tfstate-<account_id> \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws dynamodb create-table \
#     --table-name rfp-platform-tflock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region us-east-1
# ---------------------------------------------------------------------------
