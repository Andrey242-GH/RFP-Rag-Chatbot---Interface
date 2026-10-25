# ---------------------------------------------------------------------------
# DynamoDB Module
#
# Creates all 8 tables for the RFP Platform:
#   - users            PK: id, GSI: email-index
#   - rfp-documents    PK: id, GSI: uploadedBy-index
#   - proposals        PK: id, GSI: createdBy-index, status-index
#   - answers          PK: id, GSI: rfpId-index
#   - questions        PK: id, GSI: rfpId-index
#   - knowledge        PK: id, GSI: domain-index
#   - audit-log        PK: id, TTL: expiresAt
#   - chat-sessions    PK: id
# ---------------------------------------------------------------------------

locals {
  billing_mode = "PAY_PER_REQUEST" # On-demand for cost optimization
}

resource "aws_dynamodb_table" "users" {
  name         = "${var.name_prefix}-users"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-users" })
}

resource "aws_dynamodb_table" "rfp_documents" {
  name         = "${var.name_prefix}-rfp-documents"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "uploadedBy"
    type = "S"
  }

  global_secondary_index {
    name            = "uploadedBy-index"
    hash_key        = "uploadedBy"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-rfp-documents" })
}

resource "aws_dynamodb_table" "proposals" {
  name         = "${var.name_prefix}-proposals"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "createdBy"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "createdBy-index"
    hash_key        = "createdBy"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-proposals" })
}

resource "aws_dynamodb_table" "answers" {
  name         = "${var.name_prefix}-answers"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "rfpId"
    type = "S"
  }

  global_secondary_index {
    name            = "rfpId-index"
    hash_key        = "rfpId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-answers" })
}

resource "aws_dynamodb_table" "questions" {
  name         = "${var.name_prefix}-questions"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "rfpId"
    type = "S"
  }

  global_secondary_index {
    name            = "rfpId-index"
    hash_key        = "rfpId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-questions" })
}

resource "aws_dynamodb_table" "knowledge" {
  name         = "${var.name_prefix}-knowledge"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "domain"
    type = "S"
  }

  global_secondary_index {
    name            = "domain-index"
    hash_key        = "domain"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-knowledge" })
}

resource "aws_dynamodb_table" "audit_log" {
  name         = "${var.name_prefix}-audit-log"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  # TTL: auto-delete audit entries older than 2 years
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-audit-log" })
}

resource "aws_dynamodb_table" "chat_sessions" {
  name         = "${var.name_prefix}-chat-sessions"
  billing_mode = local.billing_mode
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  # TTL: auto-delete sessions older than 90 days
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-chat-sessions" })
}
