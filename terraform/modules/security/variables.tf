variable "name_prefix" { type = string }
variable "vpc_id"       { type = string }
variable "vpc_cidr"     { type = string }
variable "aws_region"   { type = string }
variable "account_id"   { type = string }
variable "app_port"     { type = number; default = 3000 }
variable "s3_bucket_name" { type = string }
variable "tags" { type = map(string); default = {} }
