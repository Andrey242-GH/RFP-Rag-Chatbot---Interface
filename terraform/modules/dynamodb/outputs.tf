output "table_names" {
  value = {
    users         = aws_dynamodb_table.users.name
    rfp_documents = aws_dynamodb_table.rfp_documents.name
    proposals     = aws_dynamodb_table.proposals.name
    answers       = aws_dynamodb_table.answers.name
    questions     = aws_dynamodb_table.questions.name
    knowledge     = aws_dynamodb_table.knowledge.name
    audit_log     = aws_dynamodb_table.audit_log.name
    chat_sessions = aws_dynamodb_table.chat_sessions.name
  }
}

output "table_arns" {
  value = {
    users         = aws_dynamodb_table.users.arn
    rfp_documents = aws_dynamodb_table.rfp_documents.arn
    proposals     = aws_dynamodb_table.proposals.arn
    answers       = aws_dynamodb_table.answers.arn
    questions     = aws_dynamodb_table.questions.arn
    knowledge     = aws_dynamodb_table.knowledge.arn
    audit_log     = aws_dynamodb_table.audit_log.arn
    chat_sessions = aws_dynamodb_table.chat_sessions.arn
  }
}
