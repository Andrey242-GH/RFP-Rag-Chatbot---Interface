variable "name_prefix" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "enable_versioning" {
  type    = bool
  default = false
}

variable "allowed_origins" {
  type    = list(string)
  default = ["*"]
}
