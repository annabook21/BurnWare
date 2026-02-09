# BurnWare

Anonymous inbox system with short links, QR codes, end-to-end encryption, and burnable threads. Built on AWS CDK with a NAT-free architecture.

![BurnWare AWS Architecture](architecture-diagram.drawio.svg)

## How It Works

1. **Owners** authenticate via Cognito, create anonymous inbox links, and manage incoming threads through a retro AIM-styled dashboard
2. **Senders** visit a link URL, compose a message (encrypted client-side with ECDH P-256 + AES-256-GCM), and submit anonymously — no account required
3. **Real-time** notifications flow via AppSync Events WebSocket; a Lambda proxy bridges the NAT-free VPC to the public Events API
4. **Burning** permanently destroys messages (hard delete) and marks threads/links as destroyed

## Architecture

### CDK Stacks (8 total, deployed in order)

| Stack | Purpose | Key Resources |
|-------|---------|---------------|
| **NetworkStack** | VPC foundation | VPC (10.0.0.0/16), 0 NAT gateways, 12 VPC endpoints, security groups |
| **AuthStack** | Owner authentication | Cognito User Pool (email sign-in, optional MFA, threat detection PLUS) |
| **DataStack** | Persistence | RDS PostgreSQL 16 (KMS-encrypted, force SSL), S3 deployment bucket |
| **WafStack** | Edge security | WAF WebACL (rate limiting with CAPTCHA, AWS managed rules for SQLi/XSS) |
| **AppSyncStack** | Real-time messaging | AppSync Events API (WebSocket pub/sub), Lambda publish proxy |
| **AppStack** | Application compute | Internal ALB, EC2 Auto Scaling Group (t3.micro, AL2023), CodeDeploy |
| **FrontendStack** | Static hosting + CDN | CloudFront with VPC Origin for /api/*, S3 for React SPA |
| **ObservabilityStack** | Monitoring | CloudWatch log groups, SNS alert topic, CloudWatch alarms |

### NAT-Free Design

EC2 instances have zero internet access. All AWS service communication flows through VPC endpoints (11 interface + 1 gateway). Dependencies like `node_modules` are bundled in the deployment artifact. The Lambda proxy pattern handles AppSync Events publishing since the Events API is public-only and unreachable from within the VPC.

### Key Design Decisions

- **NAT-free**: Saves ~$65/month. All AWS access via VPC endpoints.
- **E2EE**: ECDH P-256 + AES-256-GCM via Web Crypto API. Server stores ciphertext only.
- **Possession-based auth**: Knowing a thread UUID = authorized (no sender accounts).
- **Rate limits keyed on resource IDs, not IPs**: Preserves sender anonymity.
- **Raw SQL over ORM**: Full query control, PostgreSQL-specific features (partial indexes, triggers).
- **Custom WebSocket over Amplify**: Amplify's Events client sends malformed subscribe messages.
- **Lambda proxy for AppSync**: Events API is public-only; VPC endpoint only supports private GraphQL.

## Project Structure

```
bin/burnware.ts          # CDK app entry point
lib/
  stacks/                # 8 CDK stack definitions
  constructs/            # Reusable CDK constructs (compute, networking, security, storage)
  config/                # Environment configs (dev.ts, prod.ts) and constants
  utils/                 # Naming conventions and tagging utilities

app/                     # Express 5 API (Node.js 20, PM2 cluster mode)
  src/
    controllers/         # HTTP request handlers
    services/            # Business logic (links, messages, threads, tokens, QR, AppSync publisher)
    models/              # Database access (raw SQL via pg, no ORM)
    middleware/          # Auth (JWT), validation (Joi), rate limiting, error handling
    routes/              # Public + authenticated route definitions
  deployment/            # CodeDeploy appspec.yml + lifecycle scripts
  tests/                 # Jest integration tests

frontend/                # React 18 SPA (Vite + styled-components + 98.css)
  src/
    components/          # AIM-styled UI (WindowFrame, BuddyList, ChatWindow, etc.)
    hooks/               # useAppSyncEvents, useMessagePolling, useAIMSounds
    utils/               # E2EE (Web Crypto API), key store (IndexedDB), API client
    config/              # Cognito, AppSync, API endpoint configuration

database/
  schema.sql             # PostgreSQL schema (users, links, threads, messages, audit_log)
  migrations/            # Incremental migrations (E2EE columns, OPSEC fields, etc.)
```

## Database

PostgreSQL 16 with 5 tables. Foreign keys cascade on delete. Triggers auto-increment `message_count` on threads and links.

| Table | PK | Purpose |
|-------|-----|---------|
| `users` | `user_id` (Cognito sub, VARCHAR) | Owner accounts |
| `links` | `link_id` (base64url token, VARCHAR 16) | Anonymous inbox endpoints with E2EE public keys |
| `threads` | `thread_id` (UUIDv4) | Conversations started by anonymous senders |
| `messages` | `message_id` (UUIDv4) | Individual messages (ciphertext or plaintext, max 10KB) |
| `audit_log` | `audit_id` (UUIDv4) | Security event trail (no IP addresses stored) |

## API

### Public Endpoints (Unauthenticated)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check (shallow) |
| `GET` | `/health/ready` | Readiness check (tests DB) |
| `GET` | `/api/v1/link/:link_id/metadata` | Link public info (name, QR, E2EE key, OPSEC config) |
| `POST` | `/api/v1/send` | Send anonymous message (WAF rate limited + CAPTCHA) |
| `GET` | `/api/v1/thread/:thread_id` | View thread as sender (possession-based) |
| `POST` | `/api/v1/thread/:thread_id/reply` | Anonymous follow-up message |
| `POST` | `/api/v1/thread/:thread_id/unlock` | Unlock passphrase-protected thread |

### Dashboard Endpoints (JWT Required)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/dashboard/links` | Create link |
| `GET` | `/api/v1/dashboard/links` | List owner's links (paginated) |
| `GET` | `/api/v1/dashboard/links/counts` | Message counts (lightweight polling) |
| `PATCH` | `/api/v1/dashboard/links/:link_id` | Update link |
| `DELETE` | `/api/v1/dashboard/links/:link_id` | Delete link |
| `GET` | `/api/v1/dashboard/links/:link_id/threads` | List threads for a link |
| `GET` | `/api/v1/dashboard/threads/:thread_id` | Thread with messages |
| `POST` | `/api/v1/dashboard/threads/:thread_id/reply` | Owner reply |
| `POST` | `/api/v1/dashboard/threads/:thread_id/burn` | Burn thread |
| `POST` | `/api/v1/dashboard/links/:link_id/burn` | Burn link + all threads |

## Getting Started

### Prerequisites

- Node.js >= 20
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

### CDK Infrastructure

```bash
npm install
npm run build
cdk bootstrap aws://ACCOUNT-ID/us-east-1   # First time only
cdk diff --context environment=dev           # Preview changes
cdk deploy --all --context environment=dev   # Deploy all stacks
```

### Backend API

```bash
cd app
npm install
npm run dev       # Local dev with ts-node
npm run build     # Compile TypeScript
npm test          # Jest integration tests
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # Vite dev server (port 3001)
npm run build     # Production build -> dist/
```

### Deploy Backend Artifact

```bash
cd app && npm ci && npm run build && npm prune --omit=dev

# Stage flat structure for CodeDeploy
mkdir -p /tmp/_bw_stage/scripts
cp deployment/appspec.yml /tmp/_bw_stage/
cp deployment/scripts/*.sh /tmp/_bw_stage/scripts/
cp -r dist node_modules package.json ecosystem.config.js /tmp/_bw_stage/

# Create tarball (COPYFILE_DISABLE suppresses macOS resource forks)
COPYFILE_DISABLE=1 tar -czf artifact.tar.gz -C /tmp/_bw_stage .

# Upload and trigger deployment
aws s3 cp artifact.tar.gz s3://burnware-dev-deployments/releases/app-1.0.0.tar.gz
aws deploy create-deployment \
  --application-name burnware-dev-codedeploy-app \
  --deployment-group-name burnware-dev-codedeploy-group \
  --s3-location bucket=burnware-dev-deployments,key=releases/app-1.0.0.tar.gz,bundleType=tgz
```

## Security

- **E2EE**: ECDH P-256 key agreement + AES-256-GCM encryption (Web Crypto API, zero external crypto libs)
- **Anonymity**: No IP logging, no User-Agent logging, rate limits keyed on resource IDs (never IP)
- **OPSEC mode**: 24h thread expiry, device-bound/single-use access tokens, passphrase protection (PBKDF2, 600k iterations)
- **Infrastructure**: IMDSv2 required, KMS-encrypted RDS + EBS, Secrets Manager for credentials, WAF, private ALB, SSM Session Manager (no SSH)
- **Application**: Helmet headers, CORS, Joi validation, parameterized SQL, timing-safe secret comparisons

## Monitoring

```bash
# Tail application logs
aws logs tail /aws/burnware/dev/application --follow

# Connect to instance via Session Manager (no SSH)
aws ssm start-session --target i-INSTANCE-ID
```

**CloudWatch Alarms**: Unhealthy host count > 0, Target 5XX > 10/min. Both alert via SNS email.

## Documentation

| Document | Description |
|----------|-------------|
| [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) | Full technical reference — database schema, API details, infrastructure, design decisions |
| [architecture-diagram.drawio](architecture-diagram.drawio) | Editable AWS architecture diagram (open in [draw.io](https://app.diagrams.net)) |
| [CLAUDE.md](CLAUDE.md) | AI assistant instructions and build commands |

## Code Constraints

All TypeScript files must be under 500 lines, enforced by `npm run lint:file-size`.

## License

ISC
