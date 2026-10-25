# ---------------------------------------------------------------------------
# Common local values re-used across every module call.
# Each environment overrides the variables; this file derives tags and
# naming helpers that every module inherits.
# ---------------------------------------------------------------------------

locals {
  # Full resource name prefix:  rfp-platform-demo, rfp-platform-prod, etc.
  name_prefix = "rfp-platform-${var.environment}"

  common_tags = {
    Project     = "rfp-platform"
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner_email
  }

  # Bedrock model IDs — kept here so every module references the same source
  bedrock_generation_model  = "anthropic.claude-3-5-sonnet-20241022-v2:0"
  bedrock_evaluation_model  = "anthropic.claude-3-opus-20240229-v1:0"
  bedrock_embedding_model   = "amazon.titan-embed-text-v2:0"
  opensearch_index_name     = "rfp-knowledge-base"
}
