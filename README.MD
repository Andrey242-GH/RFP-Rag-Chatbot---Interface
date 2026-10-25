# RFP Platform

RFP Platform is a web application for managing the request-for-proposal (RFP) and proposal workflow. It uses AI to extract requirements from uploaded RFP documents, find relevant knowledge-base content, draft and evaluate answers, and assemble proposals for review.

## Features

- Upload PDF, DOCX, and TXT RFP documents for processing.
- Review extracted questions, requirements, and evaluation criteria.
- Generate, edit, evaluate, regenerate, and assemble proposal answers.
- Search and chat with a knowledge base, with source citations and confidence information.
- Track proposal lifecycle and analytics.
- Manage users, roles, and audit history through the admin area.

## Technology

- Next.js, React, and TypeScript (`rfp-platform/`)
- AWS DynamoDB for application data
- Amazon S3 for documents
- Amazon Textract for document text extraction
- Amazon Bedrock for generation, evaluation, and embeddings
- Amazon OpenSearch for knowledge-base search
- Terraform modules for infrastructure (`terraform/`)

## Requirements

- Node.js compatible with Next.js 16 (Node.js 20.9 or newer)
- npm
- AWS credentials and provisioned AWS resources for backend features

You can start the web app without AWS configuration to inspect the interface. Features that read or write application data, process documents, or use AI require the corresponding AWS services, permissions, and configuration.

## Run locally

```bash
cd rfp-platform
npm ci
cp .env.example .env.local
```

At minimum, set a unique session secret in `.env.local`. Generate one with:

```bash
openssl rand -base64 32
```

Paste the result as the value of `SESSION_SECRET`. To use backend features, configure the AWS region and credentials (or use an AWS credential provider such as an IAM role), the DynamoDB table names, S3 bucket, Cognito values if used, OpenSearch endpoint, and Bedrock model IDs. The names in `.env.example` must match the resources provisioned in your AWS account.

Start the development server:

```bash
npm run dev
```

Open <http://localhost:3000>. The home page redirects to the RFP upload page. The health endpoint is available at <http://localhost:3000/api/health>.

## Sign-in

The login endpoint checks that the email belongs to a user in the configured DynamoDB users table and then compares the password with `AUTH_DEV_PASSWORD`. If `AUTH_DEV_PASSWORD` is not set, the development default is `RFP-Demo-2026!`; set your own value in `.env.local` for local testing. **This shared-password check is for development/demo use, not production authentication.**

There is no built-in test email or seeded account. To sign in, create a user record in the users table with an email address and the fields required by the application. The table must also have the `email-index` secondary index used for login lookups. See `rfp-platform/src/lib/dal/users.ts` for the user record shape and lookup behavior. Production deployments should use the intended Cognito authentication flow rather than the development password.

## Application pages

- `/upload` — upload an RFP
- `/analysis` — inspect RFP analysis and extracted requirements
- `/editor` and `/preview` — work on and review proposals
- `/chat` — ask questions against the knowledge base
- `/lifecycle` — view proposal lifecycle information
- `/admin` — administer users and review platform activity
- `/api/health` — application health response

## Useful commands

Run these from `rfp-platform/`:

```bash
npm run dev     # Start the local development server
npm run lint    # Run ESLint
npm run build   # Create a production build
npm run start   # Serve the production build
```

## Infrastructure

Terraform modules for AWS resources are under `terraform/modules/`, with shared Terraform configuration under `terraform/shared/`. Review the module variables and outputs, configure the appropriate environment-specific Terraform files and backend, and check AWS costs and permissions before applying infrastructure. Do not commit AWS credentials, Terraform state, or populated secret files.

## Project layout

```text
rfp-platform/   Next.js application
terraform/      AWS infrastructure modules and shared configuration
docs/           Additional project guides
```
