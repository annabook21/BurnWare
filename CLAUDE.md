# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BurnWare is an anonymous inbox system with short links, QR codes, and expiring/burnable threads. It uses AWS CDK for infrastructure-as-code with a NAT-free architecture.

## Build and Development Commands

### CDK Infrastructure (root directory)
```bash
npm run build          # Compile TypeScript
npm run lint           # ESLint + file size check
cdk diff --context environment=dev    # Preview changes
cdk deploy --all --context environment=dev   # Deploy all stacks
cdk deploy BurnWare-App-dev --context environment=dev  # Deploy single stack
```

**Deploy frontend (UI) to dev:** UI changes only reach dev when the **Frontend** stack is deployed. The stack builds the frontend asset and runs BucketDeployment; if you ran `cdk deploy --all` but the Frontend stack wasn’t updated (e.g. no infra diff), or you only deployed another stack, the new frontend build is not live. Always deploy the Frontend stack for UI changes:
```bash
cdk deploy BurnWare-Frontend-dev --context environment=dev --require-approval never
```
Then invalidate CloudFront so the new bundle is served immediately (otherwise revalidation may take up to ~60s). Use the distribution ID from the deploy output or:
```bash
aws cloudfront create-invalidation --distribution-id $(aws cloudformation describe-stacks --stack-name BurnWare-Frontend-dev --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text --region us-east-1) --paths "/*"
```
(Frontend stack is in us-east-1 for CloudFront.)

### Backend API (app/)
```bash
cd app
npm run dev            # Run with ts-node
npm run build          # Compile TypeScript
npm run start          # Run compiled JS
npm test               # Jest tests
npm run lint           # ESLint
```

### Frontend (frontend/)
```bash
cd frontend
npm run dev            # Vite dev server
npm run build          # Production build
npm run lint           # ESLint
```

## Architecture

### CDK Stacks (7 total, deployed in order)
1. **NetworkStack** - VPC with public/private/isolated subnets, VPC endpoints (SSM, CloudWatch, Secrets Manager, X-Ray), security groups
2. **AuthStack** - Cognito User Pool for owner authentication
3. **DataStack** - RDS PostgreSQL Multi-AZ, Secrets Manager for credentials
4. **WafStack** - WAF WebACL with rate limiting (must deploy to us-east-1 for CloudFront)
5. **AppStack** - ALB, EC2 Auto Scaling Group, CodeDeploy
6. **FrontendStack** - CloudFront distribution, S3 bucket for React SPA
7. **ObservabilityStack** - CloudWatch log groups, SNS notifications

### Code Organization
```
lib/stacks/       # CDK stack definitions
lib/constructs/   # Reusable CDK constructs (compute, networking, observability, security, storage)
lib/config/       # Environment configs (dev.ts, prod.ts) and constants
lib/utils/        # Naming conventions and tagging utilities

app/src/          # Express API
  controllers/    # HTTP request handlers
  services/       # Business logic
  models/         # Database access (pg)
  middleware/     # Auth, validation, error handling
  validators/     # Joi schemas
  routes/         # Express routers

frontend/src/     # React SPA with 98.css aesthetic
```

### Key Design Decisions
- **NAT-free**: EC2 instances in private subnets access AWS services via VPC endpoints only (no internet access)
- **Environment context**: Pass `--context environment=dev|prod` to CDK commands
- **Stack dependencies**: Defined in `bin/burnware.ts` via `addDependency()`

## Code Constraints

**All TypeScript files must be under 500 lines.** This is enforced by `npm run lint:file-size`. If a file exceeds this limit, refactor into smaller modules.

## Database

PostgreSQL schema in `database/schema.sql`. Tables: users, links, threads, messages, audit_log.

## Testing

Backend integration tests in `app/tests/integration/`. Run with `cd app && npm test`.
