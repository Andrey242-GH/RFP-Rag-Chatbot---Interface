# ---------------------------------------------------------------------------
# Root-level variables shared across all environments.
# Each environment's terraform.tfvars supplies the values.
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment: demo | dev | test | prod"
  type        = string

  validation {
    condition     = contains(["demo", "dev", "test", "prod"], var.environment)
    error_message = "environment must be one of: demo, dev, test, prod"
  }
}

variable "owner_email" {
  description = "Team or individual email used in resource tags."
  type        = string
  default     = "platform-team@example.com"
}

variable "app_image_uri" {
  description = "Full ECR image URI for the Next.js application container."
  type        = string
  default     = ""
}

variable "app_port" {
  description = "Port the Next.js container listens on."
  type        = number
  default     = 3000
}

variable "cognito_allowed_email_domains" {
  description = "List of email domains permitted to self-register (leave empty for allowlist-only)."
  type        = list(string)
  default     = []
}

variable "cognito_admin_email" {
  description = "Email address of the initial admin user seeded at apply time."
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for custom domain (leave empty to skip DNS)."
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain name for the platform (e.g. rfp.example.com)."
  type        = string
  default     = ""
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection on stateful resources (DynamoDB, OpenSearch)."
  type        = bool
  default     = false
}
