variable "name_prefix" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "enable_pitr" {
  description = "Enable Point-in-Time Recovery for DynamoDB tables."
  type        = bool
  default     = false
}
