# BurnWare — Technical Documentation

> Anonymous inbox system with short links, QR codes, end-to-end encryption, and burnable threads.
> Built on AWS CDK with a NAT-free architecture.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Database Schema](#3-database-schema)
4. [CDK Infrastructure (8 Stacks)](#4-cdk-infrastructure)
5. [Networking & NAT-Free Design](#5-networking--nat-free-design)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Backend API](#7-backend-api)
8. [End-to-End Encryption](#8-end-to-end-encryption)
9. [Real-Time Messaging (AppSync Events)](#9-real-time-messaging-appsync-events)
10. [Frontend Application](#10-frontend-application)
11. [Deployment Pipeline](#11-deployment-pipeline)
12. [Security Model](#12-security-model)
13. [Observability](#13-observability)
14. [Key Design Decisions & Trade-offs](#14-key-design-decisions--trade-offs)

---

## 1. System Overview

BurnWare allows users ("owners") to create anonymous inbox links that anyone can send messages to. Owners authenticate via Cognito, create links, and manage incoming threads through a dashboard styled after AOL Instant Messenger. Anonymous senders need only the link URL — no account required.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Link** | An owner-created inbox endpoint. Has a short URL and QR code. Receives anonymous messages. |
| **Thread** | A conversation started by an anonymous sender via a link. Contains messages. |
| **Message** | A single message within a thread. Sent by either `anonymous` or `owner`. |
| **Burn** | Soft-delete that marks links/threads as destroyed. Messages are hard-deleted on burn. |
| **OPSEC Mode** | Enhanced security: 24h thread expiry, device-bound or single-use access tokens, optional passphrase. |
| **E2EE** | End-to-end encryption using ECDH P-256 + AES-256-GCM. Server never sees plaintext. |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Infrastructure | AWS CDK v2.237 (TypeScript), CloudFormation |
| Compute | EC2 Auto Scaling Group (Amazon Linux 2023, t3.micro) |
| Database | RDS PostgreSQL 16.11 (db.t3.micro, encrypted) |
| CDN / Routing | CloudFront with VPC Origins |
| Auth | Cognito User Pool (email, MFA optional) |
| Real-time | AppSync Events API (WebSocket pub/sub) |
| Frontend | React 18 + Vite + styled-components + 98.css |
| Process Mgmt | PM2 (cluster mode) |
| Deployment | CodeDeploy (OneAtATime, auto-rollback) |

---

## 2. Architecture Diagram

```
                         ┌──────────────┐
                         │   Browser    │
                         └──────┬───────┘
                                │ HTTPS
                         ┌──────▼───────┐
                    ┌────│  CloudFront   │────┐
                    │    │  + WAF WebACL │    │
                    │    └──────┬────────┘    │
                    │           │             │
              /static/*     /api/*      WebSocket
              /index.html     │         wss://
                    │         │             │
              ┌─────▼──┐  ┌──▼──────┐  ┌───▼──────────┐
              │   S3   │  │  ALB    │  │ AppSync Events│
              │ Bucket │  │(private)│  │  (public API) │
              └────────┘  └──┬──────┘  └───────┬───────┘
                             │ :3000           │
                       ┌─────▼──────┐          │
                       │    EC2     │          │
                       │  (PM2 +   │    ┌─────▼──────┐
                       │  Express) ├───►│   Lambda   │
                       └──┬────┬───┘    │  (publish) │
                          │    │        └────────────┘
                    ┌─────▼┐ ┌─▼────────┐
                    │  RDS │ │  Secrets  │
                    │ PG16 │ │  Manager  │
                    └──────┘ └──────────┘

        ── All EC2↔AWS traffic via VPC Endpoints (no NAT) ──
```

**Data flow for anonymous message:**
1. Sender visits `https://burnware.live/l/{linkId}`
2. CloudFront serves React SPA from S3
3. SPA fetches link metadata: `GET /api/v1/link/{linkId}/metadata` → CloudFront → ALB → EC2
4. Sender encrypts message client-side (ECDH + AES-GCM) and POSTs to `/api/v1/send`
5. EC2 stores ciphertext in PostgreSQL, invokes Lambda (via VPC endpoint) to publish AppSync event
6. Lambda publishes to AppSync Events HTTP API (over internet, since Events API is public-only)
7. Owner's dashboard receives WebSocket event, fetches and decrypts thread

---

## 3. Database Schema

PostgreSQL 16.11 on RDS. Extensions: `uuid-ossp`, `pgcrypto`.

### 3.1 `users` Table

Stores Cognito user metadata for authenticated link owners.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | `VARCHAR(128)` | **PK** | Cognito `sub` identifier |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE | Owner's email |
| `created_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Account creation |
| `updated_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Auto-updated by trigger |
| `last_login_at` | `TIMESTAMP` | NULL | Most recent login |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT TRUE | Account active flag |

**Indexes:**
| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `idx_users_email` | `email` | B-tree | Email lookup on login |
| `idx_users_created_at` | `created_at` | B-tree | Chronological listing |

### 3.2 `links` Table

Owner-created anonymous inbox endpoints.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `link_id` | `VARCHAR(16)` | **PK** | Base64url token (12 random bytes → 16 chars) |
| `owner_user_id` | `VARCHAR(128)` | NOT NULL, **FK → users(user_id) ON DELETE CASCADE** | Link owner |
| `display_name` | `VARCHAR(100)` | NOT NULL, CHECK len >= 1 | Human-readable name |
| `description` | `VARCHAR(500)` | NULL | Optional description |
| `created_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Auto-updated by trigger |
| `expires_at` | `TIMESTAMP` | NULL | Optional expiration (1–365 days from creation) |
| `burned` | `BOOLEAN` | NOT NULL, DEFAULT FALSE | Soft-delete flag |
| `message_count` | `INTEGER` | NOT NULL, DEFAULT 0 | Total messages across all threads (auto-incremented by trigger) |
| `qr_code_url` | `VARCHAR(500)` | NULL | S3 URL to generated QR PNG |
| `public_key` | `TEXT` | NULL | Owner's ECDH P-256 public key (base64 raw, 65 bytes uncompressed) |
| `opsec_mode` | `BOOLEAN` | NOT NULL, DEFAULT FALSE | OPSEC mode enabled |
| `opsec_access` | `VARCHAR(20)` | NULL | `'device_bound'` or `'single_use'` (when opsec_mode=TRUE) |
| `opsec_passphrase_hash` | `VARCHAR(256)` | NULL | PBKDF2 hash (hex) of passphrase |
| `opsec_passphrase_salt` | `VARCHAR(64)` | NULL | PBKDF2 salt (hex) |
| `wrapped_key` | `TEXT` | NULL | AES-wrapped private key backup (for key recovery) |
| `backup_salt` | `VARCHAR(128)` | NULL | Salt for key backup encryption |
| `backup_iv` | `VARCHAR(128)` | NULL | IV for key backup encryption |

**Indexes:**
| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `idx_links_owner` | `owner_user_id` | B-tree | Dashboard: list owner's links |
| `idx_links_expires_at` | `expires_at` | Partial (WHERE expires_at IS NOT NULL) | Expiration cleanup queries |
| `idx_links_burned` | `burned` | Partial (WHERE burned = FALSE) | Filter active links efficiently |
| `idx_links_created_at` | `created_at` | B-tree | Chronological sorting |

**Design decisions:**
- **`link_id` is the PK and the short-URL token.** No surrogate key — the token *is* the identity. Generated via `crypto.randomBytes(12).toString('base64url')`, giving 96 bits of entropy (collision probability negligible at expected scale).
- **`message_count` is denormalized** and maintained by a PostgreSQL trigger on `messages` INSERT. This avoids COUNT(*) queries on the hot-path dashboard polling endpoint (`GET /links/counts`), which returns only `{link_id, message_count}` pairs.
- **`public_key` stored as base64 raw bytes** (65 bytes for uncompressed P-256 point). Not JWK — JWK is too large and the private key is never on the server.
- **OPSEC columns live on the link** (not a separate table) because OPSEC is an attribute of the link, not an independent entity. Threads inherit OPSEC settings at creation time.
- **`wrapped_key` / `backup_salt` / `backup_iv`** enable key recovery: the owner's private key is AES-wrapped with a passphrase-derived key and stored server-side. The server cannot unwrap it (doesn't know the passphrase).

### 3.3 `threads` Table

Conversations initiated by anonymous senders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `thread_id` | `UUID` | **PK**, DEFAULT `uuid_generate_v4()` | Unguessable thread identifier |
| `link_id` | `VARCHAR(16)` | NOT NULL, **FK → links(link_id) ON DELETE CASCADE** | Parent link |
| `created_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Thread creation |
| `updated_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Auto-updated by trigger |
| `burned` | `BOOLEAN` | NOT NULL, DEFAULT FALSE | Soft-delete flag |
| `message_count` | `INTEGER` | NOT NULL, DEFAULT 0 | Message count (auto-incremented by trigger) |
| `sender_anonymous_id` | `VARCHAR(64)` | NOT NULL, CHECK len >= 8 | Random 8-char hex ID (per-thread, NOT traceable) |
| `sender_public_key` | `TEXT` | NULL | Sender's ephemeral ECDH P-256 public key (for E2EE replies) |
| `expires_at` | `TIMESTAMP` | NULL | 24h from creation (OPSEC mode only) |
| `access_token_hash` | `VARCHAR(64)` | NULL | SHA-256 of access token (OPSEC device-bound/single-use) |
| `passphrase_hash` | `VARCHAR(256)` | NULL | PBKDF2 hash copied from parent link |
| `passphrase_salt` | `VARCHAR(64)` | NULL | PBKDF2 salt copied from parent link |

**Indexes:**
| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `idx_threads_link_id` | `link_id` | B-tree | List threads for a link |
| `idx_threads_created_at` | `created_at` | B-tree | Chronological sorting |
| `idx_threads_burned` | `burned` | Partial (WHERE burned = FALSE) | Active thread filtering |
| `idx_threads_expires_at` | `expires_at` | Partial (WHERE expires_at IS NOT NULL) | Expiry cleanup |

**Intentionally NOT indexed:** `sender_anonymous_id`. This column is random per-thread. Cross-thread sender correlation is deliberately impossible — there is no index to make such lookups efficient, and the values carry no semantic link between threads.

**Design decisions:**
- **UUID v4 as PK** because thread_id doubles as a possession secret: knowing the UUID grants read access. UUIDs have 122 bits of entropy — unguessable.
- **`access_token_hash` stores SHA-256**, not the raw token. The raw token (32-char hex, 128-bit entropy) is returned to the sender once at thread creation and never stored. Verified with `crypto.timingSafeEqual`.
- **Passphrase fields are copied from the parent link** at thread creation. This snapshot means changing the link's passphrase doesn't retroactively affect existing threads.

### 3.4 `messages` Table

Individual messages within threads.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `message_id` | `UUID` | **PK**, DEFAULT `uuid_generate_v4()` | Unique message ID |
| `thread_id` | `UUID` | NOT NULL, **FK → threads(thread_id) ON DELETE CASCADE** | Parent thread |
| `content` | `TEXT` | NOT NULL, CHECK len >= 1 AND len <= 10000 | Ciphertext (base64) or plaintext |
| `created_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Message timestamp |
| `sender_type` | `VARCHAR(20)` | NOT NULL, CHECK IN ('anonymous', 'owner') | Who sent it |
| `sender_id` | `VARCHAR(128)` | NULL | Cognito sub for owner messages; NULL for anonymous |

**Indexes:**
| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `idx_messages_thread_id` | `thread_id` | B-tree | Fetch messages for a thread |
| `idx_messages_created_at` | `created_at` | B-tree | Chronological ordering |
| `idx_messages_sender_type` | `sender_type` | B-tree | Filter by sender type |

**Design decisions:**
- **`content` stores ciphertext when E2EE is enabled.** The server has no knowledge of whether content is encrypted or plaintext — it's opaque TEXT up to 10KB. The 10KB limit accommodates base64 overhead on encrypted payloads (original plaintext limit is effectively ~7KB).
- **`sender_id` is NULL for anonymous** senders. This is by design — the server genuinely does not know who the anonymous sender is. For owner messages, the Cognito `sub` is stored for audit.
- **No `updated_at` trigger** on messages — messages are immutable once created.

### 3.5 `audit_log` Table

Security and compliance event trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `audit_id` | `UUID` | **PK**, DEFAULT `uuid_generate_v4()` | Audit entry ID |
| `event_type` | `VARCHAR(50)` | NOT NULL | Event name (e.g., `link_created`, `thread_burned`) |
| `user_id` | `VARCHAR(128)` | NULL | Actor's Cognito sub (NULL for anonymous actions) |
| `resource_type` | `VARCHAR(50)` | NULL | `'link'`, `'thread'`, etc. |
| `resource_id` | `VARCHAR(128)` | NULL | The affected resource's ID |
| `event_data` | `JSONB` | NULL | Structured event metadata |
| `created_at` | `TIMESTAMP` | NOT NULL, DEFAULT NOW() | Event timestamp |

**Indexes:**
| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `idx_audit_event_type` | `event_type` | B-tree | Filter by event type |
| `idx_audit_user_id` | `user_id` | B-tree | Events by actor |
| `idx_audit_created_at` | `created_at` | B-tree | Chronological audit |
| `idx_audit_resource` | `(resource_type, resource_id)` | Composite B-tree | Events for a specific resource |

**Design decision:** IP addresses are intentionally NOT stored. This preserves anonymous sender privacy at the cost of reduced forensic capability.

### 3.6 Triggers & Functions

```sql
-- Auto-update updated_at on any row modification
CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql;

-- Applied to: users, links, threads (BEFORE UPDATE)

-- Auto-increment message counts on both thread AND parent link
CREATE FUNCTION increment_message_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE threads SET message_count = message_count + 1 WHERE thread_id = NEW.thread_id;
  UPDATE links SET message_count = message_count + 1
    WHERE link_id = (SELECT link_id FROM threads WHERE thread_id = NEW.thread_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Applied to: messages (AFTER INSERT)
```

**Why triggers instead of application-level counters:** Race conditions. Multiple concurrent message INSERTs could produce incorrect counts with `SELECT count + 1; UPDATE`. PostgreSQL row-level locks on the trigger UPDATE serialize counter increments correctly.

### 3.7 Cleanup Function

```sql
CREATE FUNCTION cleanup_expired_links() RETURNS INTEGER AS $$
-- Deletes links where expires_at < NOW() - INTERVAL '30 days' AND burned = FALSE
-- Returns count of deleted records
-- Must be called externally (cron/scheduled Lambda) — not auto-scheduled
```

### 3.8 Entity-Relationship Summary

```
users (1) ──────< links (1) ──────< threads (1) ──────< messages
  PK: user_id       PK: link_id       PK: thread_id       PK: message_id
                     FK: owner_user_id  FK: link_id          FK: thread_id

                                        audit_log
                                        PK: audit_id
                                        (resource_type, resource_id) → any entity
```

All foreign keys use `ON DELETE CASCADE`: deleting a user cascades to links → threads → messages.

### 3.9 Database Connection

- **Credentials:** Fetched from AWS Secrets Manager at pool initialization
- **Pool:** max 20 connections, 30s idle timeout, 10s connect timeout
- **SSL:** Enabled (`rejectUnauthorized: false` — acceptable within private VPC with encrypted RDS)
- **Migrations:** Run automatically on startup via `CREATE TABLE IF NOT EXISTS` and idempotent `ALTER TABLE` statements
- **Parameter Group:** `rds.force_ssl = 1`, `log_statement = all`, `log_min_duration_statement = 1000` (slow query > 1s)

---

## 4. CDK Infrastructure

8 stacks deployed in dependency order. All stacks are in `us-east-1`.

### 4.1 Stack Dependency Graph

```
NetworkStack ─────────────────────────────────┐
    │                                         │
    ├──► DataStack (VPC, isolated subnets)     │
    │                                         │
    ├──► AppSyncStack (VPC, Lambda endpoint)   │
    │                                         │
AuthStack ──────────────────────┐              │
    │                          │              │
WafStack ──────────────────┐   │              │
    │                      │   │              │
    │              ┌───────▼───▼──────────────▼──┐
    │              │        AppStack              │
    │              │  (ALB, ASG, CodeDeploy)      │
    │              └──────────┬──────────────────-┘
    │                         │
    └──────────────┐          │
                   ▼          ▼
            ┌──────────────────────┐
            │    FrontendStack     │
            │ (CloudFront, S3)     │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  ObservabilityStack  │
            │ (CloudWatch, SNS)    │
            └──────────────────────┘
```

### 4.2 NetworkStack

Creates the VPC foundation with zero NAT gateways.

**VPC:**
- CIDR: `10.0.0.0/16`
- AZs: 2 (us-east-1a, us-east-1b)
- NAT Gateways: 0
- Subnets per AZ:
  - **Public** (`/24`): ALB placement
  - **Private with Egress** (`/24`): EC2 instances (routed to VPC endpoints, not internet)
  - **Isolated** (`/24`): RDS (no route to anything outside VPC)
- DNS hostnames + DNS support: enabled
- VPC Flow Logs → CloudWatch (30-day retention)

**Security Groups (least-privilege, `allowAllOutbound: false`):**

| SG | Inbound | Outbound |
|----|---------|----------|
| **ALB** | CloudFront origin-facing prefix list → TCP 80 | → EC2 SG on TCP 3000 |
| **EC2** | ALB SG → TCP 3000 | → RDS SG on TCP 5432; → VPC Endpoint SG on TCP 443; → S3 prefix list on TCP 443 |
| **RDS** | EC2 SG → TCP 5432 | None |
| **VPC Endpoint** | EC2 SG → TCP 443 | None |

**Why `allowAllOutbound: false`:** Default CDK security groups allow all outbound. Explicit outbound rules enforce that EC2 can only reach RDS, VPC endpoints, and S3 — nothing else. This is critical in a NAT-free architecture where "nothing else" literally means nothing else.

**VPC Endpoints (11 interface + 1 gateway):**

| Endpoint | Type | Purpose |
|----------|------|---------|
| S3 | Gateway | Artifact download, QR upload, CodeDeploy kit, dnf repos |
| SSM | Interface | Session Manager (bastion replacement) |
| SSM Messages | Interface | Session Manager data channel |
| EC2 Messages | Interface | EC2 agent communication |
| CloudWatch Logs | Interface | Application logging |
| Secrets Manager | Interface | Database credential retrieval |
| CloudWatch Monitoring | Interface | Metrics publishing |
| X-Ray | Interface | Distributed tracing |
| CodeDeploy | Interface | Deployment agent |
| CodeDeploy Commands Secure | Interface | Secure deployment channel |
| Cognito IDP | Interface | JWT validation (JWKS fetch) |
| Lambda | Interface | AppSync Events publish proxy |

**Cognito IDP special case:** Only available in `us-east-1b` and `us-east-1c` (not `us-east-1a`). The construct filters subnets by `availabilityZones` to place the endpoint ENI only in supported AZs. Private DNS still resolves VPC-wide.

### 4.3 AuthStack

**Cognito User Pool:**
- Sign-in: email only (no username)
- Self sign-up: enabled
- Email verification: automatic
- Password: min 12 chars, uppercase + lowercase + digit + symbol
- MFA: optional (TOTP + SMS)
- Threat protection: PLUS tier, full function (adaptive auth, compromised credential detection)
- Account recovery: email only

**User Pool Client (SPA):**
- No client secret (SPAs can't store secrets)
- Auth flows: USER_PASSWORD_AUTH, USER_SRP_AUTH
- Token validity: access 1h, ID 1h, refresh 30 days
- Prevent user existence errors: enabled (returns generic error for non-existent emails)

### 4.4 DataStack

**RDS PostgreSQL:**
- Engine: PostgreSQL 16.11
- Instance: db.t3.micro (configurable per environment)
- Storage: 20 GiB GP3, KMS-encrypted with auto key rotation
- Subnets: isolated only (no route to internet or VPC endpoints)
- Multi-AZ: configurable (currently single-AZ in dev)
- Backup: 7-day retention, 03:00–04:00 UTC window
- Performance Insights: enabled
- Parameter group: `rds.force_ssl=1`, slow query logging at 1s threshold
- Credentials: Secrets Manager (32-char random password, `postgres` user)

**Deployment S3 Bucket:**
- SSE-S3 encryption, versioning enabled
- All public access blocked
- Used for CodeDeploy artifacts (`releases/*`, `artifacts/*`)

### 4.5 WafStack

**Scope:** CloudFront (deployed to us-east-1).

| Priority | Rule | Match | Action |
|----------|------|-------|--------|
| 1 | Rate limit (anonymous send) | `/api/v1/send` | CAPTCHA (10 req / 5 min per IP, 300s immunity) |
| 2 | AWS Managed: Common Rule Set | — | Block (SQLi, XSS, etc.) |
| 3 | AWS Managed: Known Bad Inputs | — | Block (malformed requests) |

**Why CAPTCHA over BLOCK for rate limiting:** Legitimate users behind shared IPs (corporate networks, mobile carriers) shouldn't be permanently blocked. CAPTCHA allows them to prove they're human and continue.

### 4.6 AppSyncStack

**AppSync Events API** (real-time WebSocket pub/sub):
- Authentication: API_KEY (browsers) + IAM (backend)
- Channel namespace: `messages`
- Channels: `/messages/thread/{threadId}`, `/messages/link/{linkId}`

**Lambda Proxy Function:**
- Runtime: Node.js 20, 128 MB, 10s timeout
- Purpose: Publishes to AppSync Events HTTP API over the public internet
- Why: AppSync Events APIs are always public. The `appsync-api` VPC endpoint only supports private *GraphQL* APIs, not Events. EC2 in the NAT-free VPC cannot reach public endpoints directly, so it invokes this Lambda (via the Lambda VPC endpoint), and the Lambda publishes over the internet.

### 4.7 AppStack

**ALB:**
- Private subnets (NOT internet-facing)
- HTTP listener on port 80 (HTTPS with TLS 1.2 if certificate provided)
- Target group: port 3000, health check `/health` every 30s
- Stickiness: 1h cookie
- Deregistration delay: 30s
- No explicit name (avoids CloudFormation replacement failures)

**Launch Template:**
- AMI: Amazon Linux 2023 (x86_64)
- Instance: t3.micro
- IMDSv2 required (hop limit 1)
- 20 GiB encrypted GP3 root volume
- No public IP

**User Data (4 phases):**
1. **System packages:** `echo "ip_resolve=4" >> /etc/dnf/dnf.conf` (forces IPv4 for S3 dualstack URLs), installs Node.js 20, jq, ruby
2. **CodeDeploy agent:** Downloaded from `s3://aws-codedeploy-{region}/latest/install`, configured with `:enable_auth_policy: true` for VPC endpoint mode
3. **Environment:** Writes `.env` with DB credentials, Cognito IDs, AppSync config, region
4. **Application:** Downloads artifact from S3, extracts, starts via PM2

**Auto Scaling Group:**
- Min/Max/Desired: 1/2/1 (dev)
- Health checks: ELB-based, 30s grace period
- Scaling policy: target CPU 70%, 5-min cooldown
- Update: rolling (1 at a time, min 1 in service)

**CodeDeploy:**
- Config: OneAtATime
- Auto-rollback on failure or stopped deployment
- Agent installed from S3 (not managed by CodeDeploy)

### 4.8 FrontendStack

**S3 Bucket:** SSE-S3, all public access blocked, auto-delete on stack destroy.

**CloudFront Distribution:**

| Path | Origin | Cache | Purpose |
|------|--------|-------|---------|
| `/` (default) | S3 (OAC) | 5 min TTL | SPA index.html |
| `/static/*` | S3 (OAC) | 1 year TTL | Versioned assets (JS, CSS, images) |
| `/api/*` | VPC Origin → ALB | Disabled | API proxy (same-origin, avoids CORS/mixed content) |

**Runtime Config:**
```json
// Deployed as /runtime-config.json to S3 via s3deploy.Source.jsonData()
// CDK tokens are resolved at CloudFormation deploy time, not at synth/build time
{
  "appSync": {
    "httpDns": "xxx.appsync-api.us-east-1.amazonaws.com",
    "realtimeDns": "xxx.appsync-realtime-api.us-east-1.amazonaws.com",
    "apiKey": "da2-xxxxxxxxxx"
  }
}
```

**Why runtime config instead of VITE_* env vars:** CDK tokens (e.g., `${Token[TOKEN.123]}`) are CloudFormation references that don't resolve until deployment. Vite builds happen at CDK synth time. Passing tokens as `VITE_*` env vars produces literal `${Token[...]}` strings in the bundle. Runtime config is deployed as a static JSON file with values resolved by CloudFormation, and the SPA fetches it at page load.

**Error pages:** 404 and 403 both return `/index.html` (SPA client-side routing).

### 4.9 ObservabilityStack

**Log Groups:**
- `/aws/burnware/{env}/application` — 30-day retention
- `/aws/burnware/{env}/access` — 7-day retention
- `/aws/vpc/{vpc-name}-{env}/flowlogs` — 30-day retention

**SNS Topic:** `burnware-{env}-alerts` with email subscription.

**CloudWatch Alarms:**
- Unhealthy host count > 0 for 2 consecutive 1-min periods → SNS
- Target 5XX count > 10 for 2 consecutive 1-min periods → SNS

---

## 5. Networking & NAT-Free Design

### Why No NAT

NAT Gateways cost ~$32/month per AZ at minimum, plus data processing charges. For a project with low-to-moderate traffic, this is a significant portion of the AWS bill. BurnWare eliminates NAT entirely by routing all AWS service access through VPC endpoints.

### How It Works

EC2 instances sit in "private with egress" subnets. Despite the name (CDK's default), there is no actual egress — no NAT, no internet gateway route. All outbound traffic flows through:

1. **S3 Gateway Endpoint** — Free. Handles artifact downloads, QR code uploads, dnf package repos (AL2023 repos are on S3), CodeDeploy agent installation.
2. **Interface Endpoints** — Per-hour cost (~$0.01/hr each). Private DNS resolves `*.amazonaws.com` to endpoint ENIs within the VPC.

### Gotchas Encountered

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `dnf install` hangs | AL2023 uses `s3.dualstack` URLs, resolves IPv6 first, S3 gateway only routes IPv4 | `echo "ip_resolve=4" >> /etc/dnf/dnf.conf` |
| S3 access denied through gateway | Gateway routes to S3 public IPs via prefix list, not through VPC endpoint SG | EC2 SG needs explicit egress to S3 prefix list on TCP 443 |
| Public S3 buckets fail | All S3 requests through gateway use IAM auth | EC2 role needs `s3:GetObject` even for public buckets (e.g., `aws-codedeploy-{region}`) |
| Cognito JWKS fetch fails | Cognito IDP endpoint not available in us-east-1a | Filter subnets by AZ |
| AppSync Events publish fails | VPC endpoint only supports private GraphQL APIs | Lambda proxy pattern (EC2 → Lambda → AppSync) |
| npm install fails | npm registry is on the public internet | Bundle `node_modules` in deployment artifact |

---

## 6. Authentication & Authorization

### Owner Authentication (JWT)

```
Browser → Cognito (signIn) → JWT access token
Browser → CloudFront → ALB → EC2
  Authorization: Bearer <jwt>
  ↓
auth-middleware.ts:
  CognitoJwtVerifier.verify(token)
  → req.user = { sub: "cognito-user-id", email: "..." }
```

- JWT verified via `aws-jwt-verify` library (fetches JWKS from Cognito IDP VPC endpoint)
- Access tokens only (not ID tokens)
- 1-hour expiry, client refreshes via Cognito SDK

### Anonymous Sender Authorization (Possession-Based)

No authentication required. Authorization is based on knowledge of secrets:

| Secret | Grants Access To | Entropy |
|--------|-----------------|---------|
| `link_id` (in URL) | Send first message to the link | 96 bits (base64url) |
| `thread_id` (UUID in URL) | View thread, send follow-ups | 122 bits (UUIDv4) |
| `access_token` (returned once, OPSEC) | Thread access after creation | 128 bits (hex) |
| Passphrase (user-chosen) | Unlock passphrase-protected thread | User-dependent |

**OPSEC thread unlock flow:**
1. `POST /api/v1/thread/{threadId}/unlock` with `{ passphrase }`
2. Server verifies PBKDF2 hash (600k iterations, timing-safe)
3. Returns HMAC-signed nonce: `{timestamp}:{hmac(threadId:unlock:timestamp)}`
4. Client includes nonce in `X-Unlock-Token` header on subsequent requests
5. Nonce expires after 1 hour

### Authorization Matrix

| Action | Required Auth |
|--------|--------------|
| Create link | JWT (owner) |
| List own links | JWT (owner) |
| View link metadata | Possession of `link_id` |
| Send anonymous message | Possession of `link_id` + CAPTCHA (WAF) |
| View thread (sender) | Possession of `thread_id` + OPSEC token (if enabled) |
| Reply to thread (sender) | Possession of `thread_id` + OPSEC token (if enabled) |
| View thread (owner) | JWT + link ownership verification |
| Reply to thread (owner) | JWT + link ownership verification |
| Burn thread/link | JWT + link ownership verification |

---

## 7. Backend API

Express 5 application running on Node.js 20 under PM2 cluster mode.

### 7.1 Middleware Chain (execution order)

1. **Helmet** — Security headers (CSP, HSTS, X-Frame-Options)
2. **CORS** — Configurable allowed origins (`ALLOWED_ORIGINS` env var)
3. **Body Parser** — JSON + URL-encoded, 10 MB limit
4. **Request ID** — UUID per request, set as `X-Request-ID` header
5. **Request Logger** — Method, path, status, latency (deliberately omits IP and User-Agent for anonymity)
6. **Trust Proxy** — Trusts X-Forwarded-* from ALB
7. **Route Handlers** — Public routes (unauthenticated), then dashboard routes (JWT-authenticated)
8. **404 Handler** — Unmatched routes
9. **Error Handler** — Global catch-all, maps error types to HTTP status codes

### 7.2 Rate Limiting Strategy

| Limiter | Scope | Limit | Key | Purpose |
|---------|-------|-------|-----|---------|
| `authenticatedRateLimiter` | All dashboard routes | 500 / 15 min | JWT `sub` (user ID) | General abuse prevention |
| `strictRateLimiter` | Link creation | 10 / 1 hour | JWT `sub` | Prevent link spam |
| `publicRateLimiter` | `/api/v1/send` | 20 / 5 min | `link:{link_id}` | Per-link message flood prevention |
| `anonymousReplyRateLimiter` | Thread reply | 20 / 5 min | `reply:{thread_id}` | Per-thread flood prevention |
| `threadViewRateLimiter` | Thread view | 120 / 5 min | `thread:{thread_id}` | Allows ~3s polling interval |
| `unlockRateLimiter` | Passphrase unlock | 5 / 15 min | `unlock:{thread_id}` | Brute-force prevention |

**Critical design choice:** Public rate limiters key on resource IDs (`link_id`, `thread_id`), NEVER on IP address. Keying on IP would de-anonymize senders. The trade-off is that an attacker who knows a `link_id` could exhaust the rate limit for all senders to that link — but this is preferable to compromising anonymity.

### 7.3 Complete API Reference

#### Public Endpoints

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|-------------|----------|
| `GET` | `/health` | Shallow health (no DB) | — | `{ status: "healthy", timestamp }` |
| `GET` | `/health/ready` | Deep health (DB query) | — | `{ status: "ready" }` or 503 |
| `GET` | `/api/v1/link/:link_id/metadata` | Link public info | — | `{ display_name, description, qr_code_url, public_key, opsec_mode, opsec_access }` |
| `POST` | `/api/v1/send` | Send first message | `{ recipient_link_id, ciphertext?, message?, sender_public_key?, passphrase? }` | `{ thread_id, created_at, access_token?, opsec? }` |
| `GET` | `/api/v1/thread/:thread_id` | View thread (sender) | Headers: `X-Access-Token?`, `X-Unlock-Token?` | `{ thread, messages[] }` |
| `POST` | `/api/v1/thread/:thread_id/reply` | Anonymous follow-up | `{ ciphertext? \| message? }` + `X-Access-Token?` | `{ message_id, created_at }` |
| `POST` | `/api/v1/thread/:thread_id/unlock` | Passphrase unlock | `{ passphrase }` | `{ unlock_token, expires_in: 3600 }` |

#### Dashboard Endpoints (JWT required)

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|-------------|----------|
| `POST` | `/api/v1/dashboard/links` | Create link | `{ display_name, description?, expires_in_days?, public_key, opsec_mode?, opsec_access?, opsec_passphrase? }` | `{ link }` |
| `GET` | `/api/v1/dashboard/links` | List owner's links | Query: `page`, `limit` | `{ data: links[], pagination }` |
| `GET` | `/api/v1/dashboard/links/counts` | Message counts (polling) | — | `[{ link_id, message_count }]` |
| `GET` | `/api/v1/dashboard/links/:link_id` | Get link detail | — | `{ link }` |
| `PATCH` | `/api/v1/dashboard/links/:link_id` | Update link | `{ display_name?, description?, expires_in_days? }` | `{ link }` |
| `DELETE` | `/api/v1/dashboard/links/:link_id` | Delete link | — | 204 |
| `PUT` | `/api/v1/dashboard/links/:link_id/key-backup` | Store encrypted key | `{ wrapped_key, salt, iv }` | 200 |
| `GET` | `/api/v1/dashboard/links/:link_id/key-backup` | Get encrypted key | — | 200 `{ data: { wrapped_key, salt, iv } }` or 200 `{ data: null }` when no backup |
| `GET` | `/api/v1/dashboard/links/:link_id/threads` | List threads | Query: `page`, `limit` | `{ data: threads[], pagination }` |
| `GET` | `/api/v1/dashboard/threads/:thread_id` | Thread + messages | Query: `page`, `limit` | `{ thread, messages[], pagination }` |
| `POST` | `/api/v1/dashboard/threads/:thread_id/reply` | Owner reply | `{ ciphertext? \| message? }` | `{ message }` |
| `POST` | `/api/v1/dashboard/threads/:thread_id/burn` | Burn thread | `{ confirm: true }` | 204 |
| `POST` | `/api/v1/dashboard/links/:link_id/burn` | Burn link + all threads | — | 204 |

### 7.4 Validation (Joi)

All request bodies/params/queries are validated via Joi schemas in middleware before reaching controllers.

Key validation rules:
- `link_id`: regex `^[A-Za-z0-9_-]{8,16}$`
- `thread_id`: UUID format
- `display_name`: 1–100 characters
- `description`: 0–500 characters
- `content/message/ciphertext`: 1–10,000 characters
- `passphrase`: 1–128 characters (or 4–128 for OPSEC link creation)
- `expires_in_days`: 1–365
- `wrapped_key`: max 4096 characters
- `salt`, `iv`: hex strings, max 128 characters
- `page`: positive integer, default 1
- `limit`: 1–100, default 20
- `ciphertext` and `message` are mutually exclusive (XOR validation)

### 7.5 Error Handling

Custom error hierarchy:

| Error Class | HTTP Status | Code | Operational? |
|-------------|-------------|------|-------------|
| `ValidationError` | 400 | `VALIDATION_ERROR` | Yes |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` | Yes |
| `AuthorizationError` | 403 | `AUTHORIZATION_ERROR` | Yes |
| `NotFoundError` | 404 | `NOT_FOUND` | Yes |
| `RateLimitError` | 429 | `RATE_LIMIT_EXCEEDED` | Yes |
| `DatabaseError` | 500 | `DATABASE_ERROR` | No |
| `InternalError` | 500 | `INTERNAL_ERROR` | No |

Operational errors are expected (bad input, auth failures) and logged as warnings. Non-operational errors indicate bugs and are logged as errors with full context.

Response format:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Link not found or expired",
    "request_id": "uuid"
  }
}
```

### 7.6 Service Layer Architecture

```
Controller (HTTP concerns)
    ↓ validated input
Service (business logic, authorization, transactions)
    ↓ data operations
Model (parameterized SQL queries via pg)
    ↓
PostgreSQL
```

**Models use raw SQL with parameterized queries** (no ORM). This is deliberate:
- Full control over query optimization
- No N+1 query problems from lazy loading
- Explicit about what SQL runs
- Simpler mental model for PostgreSQL-specific features (partial indexes, JSONB, triggers)

**Lazy getter pattern** (critical for NAT-free environment):
```typescript
// Controllers instantiate services at module scope (import-time).
// dotenv.config() hasn't run yet → process.env.* is empty.
// Fix: lazy getters defer env var reads to first use.
private get db(): Pool { return getDb(); }
private get publishFnArn() { return process.env.APPSYNC_PUBLISH_FN_ARN; }
```

### 7.7 Burn Operations (Atomic Transactions)

Burn operations use explicit PostgreSQL transactions:

```
BEGIN
  DELETE FROM messages WHERE thread_id IN (affected threads)
  UPDATE links SET message_count = 0, burned = TRUE   -- for link burn
  UPDATE threads SET burned = TRUE WHERE ...
COMMIT
```

On error: `ROLLBACK` + release client connection back to pool. Messages are hard-deleted (not soft-deleted) because the entire point of "burning" is permanent destruction.

---

## 8. End-to-End Encryption

### Algorithm

- **Key Agreement:** ECDH on P-256 (NIST curve, Web Crypto API native)
- **Symmetric Cipher:** AES-256-GCM (authenticated encryption)
- **Key Derivation:** Raw ECDH shared secret used directly as AES key (256 bits from P-256)
- **Implementation:** Pure Web Crypto API — no external crypto libraries

### Key Lifecycle

**Owner creates a link:**
1. Browser generates ECDH P-256 key pair: `{publicKey, privateKey}`
2. Public key (65 bytes, uncompressed) sent to server as `public_key` on link creation
3. Private key stored in browser's IndexedDB (`linkKeys` store)
4. Optional: private key wrapped with passphrase-derived AES key and uploaded as backup

**Sender writes a message:**
1. Browser fetches link's `public_key` from metadata endpoint
2. Generates ephemeral ECDH key pair (fresh per message)
3. Derives shared secret: `ECDH(ephemeral_private, owner_public)` → AES-256 key
4. Encrypts: `AES-GCM(key, random_iv, plaintext)` → ciphertext + auth tag
5. Constructs blob: `0x01 || ephemeral_public[65] || iv[12] || ciphertext+tag[...]`
6. Base64-encodes and sends as `ciphertext` field

**Owner decrypts:**
1. Base64-decodes, parses version byte, ephemeral public key, IV, ciphertext
2. Retrieves private key from IndexedDB
3. Derives same shared secret: `ECDH(owner_private, ephemeral_public)`
4. Decrypts: `AES-GCM(key, iv, ciphertext)` → plaintext

**Owner replies (E2EE to sender):**
1. Sender's `sender_public_key` is stored on the thread
2. Owner derives: `ECDH(owner_private, sender_public)` → AES key
3. Encrypts reply the same way (ephemeral key = owner's link key reused)
4. Sender decrypts using their ephemeral private key (stored in sessionStorage)

### Key Storage

| Store | Persistence | Content | Purpose |
|-------|------------|---------|---------|
| IndexedDB (`linkKeys`) | Permanent | Owner private keys (JWK) | Decrypt incoming messages |
| sessionStorage (`bw:thread:*`) | Tab lifetime | Sender ephemeral private key + plaintext cache | Decrypt owner replies within session |
| Server (`wrapped_key`) | Permanent | AES-wrapped private key | Key recovery with passphrase |

**Trade-off:** Sender's ephemeral key is in sessionStorage — closing the tab loses the ability to decrypt owner's future replies. This is a deliberate privacy choice: no persistent sender-side state.

### Key Backup

```
passphrase → PBKDF2(passphrase, random_salt, 600k iterations, SHA-256) → wrapping_key
wrapping_key + random_iv → AES-256-GCM(private_key_jwk) → wrapped_key
{wrapped_key, salt, iv} → stored server-side via PUT /key-backup
```

The server stores only the wrapped blob. It cannot unwrap without the passphrase.

---

## 9. Real-Time Messaging (AppSync Events)

### Architecture

```
EC2 (NAT-free VPC)
  │
  │ Lambda.invoke() via VPC Endpoint
  ▼
Lambda (outside VPC, internet access)
  │
  │ HTTPS POST /event (API key auth)
  ▼
AppSync Events API (public)
  │
  │ WebSocket push
  ▼
Browser (subscribed via wss://)
```

### Why This Architecture

AppSync Events APIs are always public — they cannot be made private. The `appsync-api` VPC endpoint only supports private GraphQL APIs. From a NAT-free VPC, requests through the VPC endpoint receive a "Unable to find the private GraphQL API" 404 error.

The Lambda proxy pattern solves this: EC2 invokes a Lambda function (via the Lambda VPC endpoint), and the Lambda runs outside the VPC with internet access to call the public AppSync Events HTTP API.

### Channel Design

| Channel | Subscriber | Publisher | Purpose |
|---------|-----------|-----------|---------|
| `/messages/thread/{threadId}` | Anonymous sender's browser | EC2 (via Lambda) | Notify sender of owner replies |
| `/messages/link/{linkId}` | Owner's dashboard | EC2 (via Lambda) | Notify owner of new messages |

**Channel name constraints:** AppSync channels only allow `[A-Za-z0-9-/]`. Link IDs are base64url which includes underscores. Both backend (`appsync-publisher.ts`) and frontend (`useAppSyncEvents.ts`) sanitize channels: `replace(/_/g, '-')`.

### Event Payload

```json
{
  "thread_id": "uuid",
  "link_id": "base64url-token",
  "sender_type": "anonymous" | "owner",
  "timestamp": 1234567890
}
```

Events are lightweight signals — they don't contain message content. The frontend fetches the full thread data after receiving an event.

### Frontend WebSocket Implementation

Custom implementation (`useAppSyncEvents.ts`) instead of Amplify's `events.connect()` because Amplify includes extra fields in its subscribe message that AppSync Events rejects.

**Key optimizations:**
- **Shared singleton WebSocket** across all React component subscriptions (one connection for the entire app)
- **Jittered exponential backoff** on reconnect: `min(1000 * 2^attempt, 30000) + random(0, 1000)` ms
- **Keepalive tracking:** Closes connection if no `ka` heartbeat within `connectionTimeoutMs + 5000` ms
- **Debounced callbacks:** 280 ms debounce prevents refetch storms when multiple events arrive in quick succession (e.g., bulk message send)
- **Graceful degradation:** No-ops silently when AppSync config is missing (local dev without AppSync)

**WebSocket protocol:**
```
Client: new WebSocket(wss://...realtime, ['aws-appsync-event-ws', 'header-{base64({host,x-api-key})}'])
Client → Server: { type: 'connection_init' }
Server → Client: { type: 'connection_ack', connectionTimeoutMs: 300000 }
Client → Server: { type: 'subscribe', id: 'sub-1', channel: '/messages/link/abc', authorization: {host, x-api-key} }
Server → Client: { type: 'subscribe_success', id: 'sub-1' }
Server → Client: { type: 'ka' }  // keepalive heartbeat
Server → Client: { type: 'data', id: 'sub-1', event: '{"thread_id":"..."}' }
```

### Polling Fallback

WebSocket is the primary channel but has a polling fallback:
- **Fast counts poll (10s):** `GET /api/v1/dashboard/links/counts` — lightweight, returns only `{link_id, message_count}` pairs
- **Slow full fetch (30s):** `GET /api/v1/dashboard/links` — full link metadata
- **Thread detail poll (30s):** Individual thread fetches with `Promise.allSettled` for partial failure tolerance

---

## 10. Frontend Application

React 18 SPA with AIM (AOL Instant Messenger) retro aesthetic.

### Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.3.1 | UI framework |
| Vite | 6.3.2 | Build tool, dev server |
| styled-components | 6.3.8 | CSS-in-JS theming |
| 98.css | 0.1.20 | Windows 98 base styles |
| react-router-dom | 6.28.0 | Client-side routing |
| aws-amplify | 6.16.2 | Cognito auth (v6) |
| axios + axios-retry | 1.8.0 / 4.5.0 | HTTP client with retry |
| howler | 2.2.4 | Sound effects |
| react-draggable | 4.4.6 | Window dragging |
| sonner | 2.0.7 | Toast notifications |

### Routing

| Path | Component | Auth Required | Purpose |
|------|-----------|--------------|---------|
| `/` | Redirect | No | → `/dashboard` if authed, else login |
| `/dashboard` | `Dashboard` | Yes | Owner's inbox management |
| `/l/:linkId` | `SendPage` → `SendMessageWindow` | No | Anonymous message sending |
| `/thread/:threadId` | `ThreadPage` → `ThreadView` | No | Sender views replies (possession-based) |

### Component Architecture

The UI mimics AIM's multi-window desktop:

**Dashboard (owner view):**
- `LinksPanel` — AIM buddy list showing all links with status indicators (green=active, orange=expiring, gray=expired)
- `ThreadsPanel` — Per-link window showing conversation threads as AIM chat windows
- `ChatWindow` — Individual thread with message bubbles, input, send/burn buttons
- `Taskbar` — Start button (logout), mute toggle, clock
- `BackupSetupDialog` — Prompts key backup on first load if unbacked keys exist

**SendMessageWindow (sender view):**
- Two modes: compose (first message) → live chat (after send)
- Shows link metadata (title, description, E2EE indicator)
- Encrypts message client-side before sending
- After first send: shows thread with real-time updates, bookmark URL for later access

**WindowFrame (shared):**
- Draggable via react-draggable
- Resizable via pointer events (grip handle)
- Win98-style title bar with minimize/maximize/close buttons
- Z-index management for focus ordering

### Theme

```
Colors:
  brand:     #FF6B35 (orange), #FF4500 (red-orange)
  AIM blue:  #0831D9 → #1084D0 (gradient)
  desktop:   #008080 (teal)
  chrome:    #C0C0C0 (gray)
  status:    green (#00FF00), orange (#FFB84D), gray (#808080)

Font:        Tahoma, MS Sans Serif, sans-serif
Borders:     2px outset #C0C0C0 (raised), 2px inset #C0C0C0 (sunken)
Sizes:       9px (tiny), 10px (small), 11px (normal), 13px (medium), 16px (large)
```

### Sound Effects

| Sound | File | Trigger |
|-------|------|---------|
| Message send | fire-ignite.mp3 | Send button clicked |
| Burn | fire-extinguish.mp3 | Thread/link burned |
| New message | match-strike.mp3 | Anonymous message received |
| Welcome | welcome.mp3 | Login success |
| You've Got Mail | youve-got-mail.mp3 | New message alert (dashboard) |
| Files Done | files-done.mp3 | Link created |

### Runtime Configuration

`main.tsx` calls `loadRuntimeConfig()` before mounting React. This fetches `/runtime-config.json` (deployed by CDK with CloudFormation-resolved values) and merges into `awsConfig`. Falls back to `VITE_*` env vars for local development.

---

## 11. Deployment Pipeline

### Artifact Build (Backend)

```bash
# In app/ directory:
npm ci && npm run build && npm prune --omit=dev

# Stage flat structure for CodeDeploy:
mkdir /tmp/_bw_stage/scripts
cp deployment/appspec.yml /tmp/_bw_stage/
cp deployment/scripts/*.sh /tmp/_bw_stage/scripts/
cp -r dist node_modules package.json ecosystem.config.js /tmp/_bw_stage/

# Create tarball (COPYFILE_DISABLE suppresses macOS resource forks):
COPYFILE_DISABLE=1 tar -czf artifact.tar.gz -C /tmp/_bw_stage .
```

**Why bundle node_modules:** EC2 instances have no internet access (NAT-free). npm registry is unreachable. All production dependencies must be in the artifact.

**Why COPYFILE_DISABLE=1:** macOS tar creates `._` AppleDouble resource fork files and converts symlinks in `node_modules/.bin/` to regular files. This breaks PM2 execution.

### Artifact Structure

```
artifact.tar.gz (extracted to /opt/burnware/)
├── appspec.yml            # CodeDeploy lifecycle hooks
├── scripts/
│   ├── stop_application.sh      # BeforeInstall: stop PM2
│   ├── install_dependencies.sh  # AfterInstall: verify node, pm2
│   ├── start_application.sh     # ApplicationStart: pm2 start
│   └── validate_service.sh      # ValidateService: health check
├── dist/                  # Compiled TypeScript
├── node_modules/          # Bundled production dependencies
├── package.json
└── ecosystem.config.js    # PM2 cluster config
```

### CodeDeploy Lifecycle

1. **BeforeInstall** (`stop_application.sh`): Stop PM2 process, clean `/opt/burnware/` (preserves `.env`)
2. **AfterInstall** (`install_dependencies.sh`): Verify Node.js, check bundled node_modules, create log directories
3. **ApplicationStart** (`start_application.sh`): `pm2 start ecosystem.config.js`
4. **ValidateService** (`validate_service.sh`): Wait 10s, check PM2 status, poll `/health` (10 retries, 5s apart)

### PM2 Configuration

```javascript
{
  name: 'burnware-api',
  script: './dist/index.js',
  instances: 'max',           // Use all CPU cores
  exec_mode: 'cluster',       // Load-balanced clustering
  max_memory_restart: '500M',
  autorestart: true,
  max_restarts: 10,
  min_uptime: '10s'
}
```

**Why PM2 cluster mode:** Single t3.micro has 2 vCPUs. Cluster mode forks one process per CPU, doubling throughput. PM2 handles zero-downtime restarts via sequential worker replacement.

### CDK Deploy Commands

```bash
# Preview changes:
cdk diff --context environment=dev

# Deploy all stacks:
cdk deploy --all --context environment=dev

# Deploy single stack:
cdk deploy BurnWare-App-dev --context environment=dev

# Trigger CodeDeploy after artifact upload:
aws deploy create-deployment \
  --application-name burnware-dev-codedeploy-app \
  --deployment-group-name burnware-dev-codedeploy-group \
  --s3-location bucket=burnware-dev-deployments,key=releases/app-1.0.0.tar.gz,bundleType=tgz
```

---

## 12. Security Model

### Defense in Depth

| Layer | Mechanism |
|-------|-----------|
| **Edge** | CloudFront + WAF (rate limiting, CAPTCHA, AWS managed rules for SQLi/XSS) |
| **Transport** | HTTPS everywhere. RDS `force_ssl=1`. VPC endpoint traffic stays within AWS backbone. |
| **Network** | Private ALB (not internet-facing). EC2 in private subnets. RDS in isolated subnets. Security groups with deny-by-default outbound. |
| **Identity** | Cognito with MFA, threat detection (PLUS tier), 12-char password minimum. |
| **Application** | Helmet headers. CORS. Joi validation. Parameterized SQL (no ORMs, no string concatenation). |
| **Encryption** | E2EE (ECDH + AES-GCM). KMS-encrypted RDS. Encrypted EBS. Secrets Manager for credentials. |
| **Compute** | IMDSv2 required. No public IPs. SSM Session Manager (no SSH keys, no bastion). |
| **Audit** | VPC Flow Logs. CloudWatch application logs. Audit log table. Security event logging. |

### Cryptographic Primitives

| Primitive | Algorithm | Parameters | Usage |
|-----------|-----------|-----------|-------|
| Key agreement | ECDH | P-256 (secp256r1) | Message encryption key derivation |
| Symmetric encryption | AES-256-GCM | 256-bit key, 96-bit IV | Message content encryption |
| Password hashing | PBKDF2 | SHA-256, 600k iterations, 32-byte salt | OPSEC passphrases, key backup wrapping |
| Token hashing | SHA-256 | — | Access token storage |
| Nonce signing | HMAC-SHA256 | APP_SECRET | Unlock nonces (1h TTL) |
| Token generation | crypto.randomBytes | 12 bytes (link), 16 bytes (access token) | Link IDs, OPSEC tokens |

All secret comparisons use `crypto.timingSafeEqual` to prevent timing attacks.

### Privacy Guarantees

| Property | How It's Enforced |
|----------|------------------|
| Sender anonymity | No IP logging, no User-Agent logging, rate limits keyed on resource IDs not IPs |
| No cross-thread correlation | `sender_anonymous_id` is random per thread, no index for cross-thread lookups |
| Server-blind message content | E2EE: server stores ciphertext, has no private keys |
| Minimal audit trail | audit_log stores event type + resource ID, no IP, no sender identity |
| Ephemeral sender state | Sender's crypto keys in sessionStorage (tab lifetime only) |
| Burn = destruction | Burning hard-deletes messages (not soft-delete), thread marked burned |

---

## 13. Observability

### Logging

**Winston logger** with structured JSON format:
- Levels: error, warn, info, debug
- Output: Console (colored in dev, JSON in prod) + file rotation (10 MB, 5 files)
- Fields: timestamp, level, message, service (`burnware-api`), environment, request_id
- Sanitization: Passwords, tokens, secrets redacted from log output

**What's logged:**
- API requests: method, path, query, status, latency_ms
- Business metrics: `link_created`, `message_sent`, `anonymous_message_sent`, `owner_reply_sent`
- Security events: `thread_burned`, `link_burned` (with severity)
- Errors: full stack traces for non-operational errors

**What's NOT logged (by design):** IP addresses, User-Agent strings, request bodies, message content.

### CloudWatch

- Application logs → `/aws/burnware/{env}/application` (30-day retention)
- Access logs → `/aws/burnware/{env}/access` (7-day retention)
- VPC Flow Logs → `/aws/vpc/{vpc}-{env}/flowlogs` (30-day retention)
- ALB access logs → S3 bucket (30-day lifecycle)

### Alarms

| Alarm | Threshold | Period | Action |
|-------|-----------|--------|--------|
| Unhealthy host count | > 0 | 2 × 1 min | SNS email |
| Target 5XX errors | > 10 | 2 × 1 min | SNS email |

### Tracing (Optional)

OpenTelemetry instrumentation available (`ENABLE_TRACING=true`):
- OTLP exporter to ADOT collector or X-Ray daemon
- Auto-instruments Node.js HTTP, Express, pg modules
- Trace IDs propagated through `X-Request-ID` header

---

## 14. Key Design Decisions & Trade-offs

### NAT-Free Architecture
**Decision:** Zero NAT gateways, all AWS access via VPC endpoints.
**Why:** NAT costs ~$32+/month/AZ. At low-moderate traffic, this dominates the bill.
**Trade-off:** Increased complexity (11 VPC endpoints to manage), can't reach any public internet endpoint from EC2 (no npm install, no external APIs). Mitigated by bundling dependencies and using Lambda proxy for AppSync.

### PostgreSQL over DynamoDB
**Decision:** RDS PostgreSQL with raw SQL, not DynamoDB.
**Why:** Relational schema fits naturally (users → links → threads → messages). Complex queries (joins, aggregates, partial indexes, atomic transactions) are simpler in SQL. The data access patterns are known and stable.
**Trade-off:** Single writer (no horizontal write scaling), operational overhead (backups, patching). Acceptable at expected scale.

### Raw SQL over ORM
**Decision:** Parameterized `pg` queries, no Sequelize/TypeORM/Prisma.
**Why:** Full control over queries. No N+1 problems. No ORM abstraction leaks. PostgreSQL-specific features (partial indexes, JSONB, PL/pgSQL triggers) used directly.
**Trade-off:** More boilerplate. Schema changes require manual migration SQL. Mitigated by idempotent `CREATE TABLE IF NOT EXISTS` migrations on startup.

### Possession-Based Auth for Senders
**Decision:** Knowing the thread UUID = authorized to view/reply.
**Why:** Anonymous senders have no account. Any auth mechanism (sessions, cookies, tokens) can be lost. The URL itself is the credential.
**Trade-off:** Anyone with the URL can access the thread. Mitigated by OPSEC mode (access tokens, passphrases, expiry).

### E2EE with Ephemeral Sender Keys
**Decision:** Sender generates fresh ECDH key pair per message, stores in sessionStorage.
**Why:** No persistent sender-side state. Closing the tab destroys the ability to decrypt owner replies — this is a feature, not a bug.
**Trade-off:** Sender can't return to a thread from a different browser/device and decrypt historical replies. Mitigated by showing plaintext of sender's own messages (cached in sessionStorage).

### Lambda Proxy for AppSync Events
**Decision:** EC2 → Lambda (VPC endpoint) → AppSync Events (internet).
**Why:** AppSync Events API is public-only. VPC endpoint doesn't support it. NAT-free VPC can't reach public endpoints.
**Trade-off:** Extra latency (~100-200ms for Lambda cold start), additional cost per invocation. Mitigated by Lambda being lightweight (128 MB, Node.js 20, <10ms warm execution).

### Custom WebSocket over Amplify Events
**Decision:** Native WebSocket implementation in `useAppSyncEvents.ts`.
**Why:** Amplify's `events.connect()` includes extra fields in its subscribe message that AppSync Events rejects. This was a blocking bug.
**Trade-off:** Must maintain WebSocket lifecycle manually (reconnection, keepalive, subscription management). Mitigated by comprehensive implementation with backoff, keepalive tracking, and shared singleton pattern.

### Rate Limiting on Resource IDs, Not IPs
**Decision:** Public endpoints rate-limit by `link_id` or `thread_id`, never by IP.
**Why:** IP-based rate limiting de-anonymizes senders. If the server logs "IP X hit rate limit for link Y," it correlates sender identity with link access.
**Trade-off:** An attacker who knows a `link_id` can exhaust the rate limit for all senders to that link. This is an acceptable trade-off — the link owner can always create a new link.

### Denormalized Message Counts
**Decision:** `message_count` on both `links` and `threads` tables, maintained by PL/pgSQL trigger.
**Why:** The dashboard polling endpoint (`GET /links/counts`) is the hottest path. It returns only `{link_id, message_count}` pairs — no JOINs, no COUNT(*) scans.
**Trade-off:** Denormalized data can drift. Mitigated by a "fix out-of-sync counts" migration query that runs on startup.

### AIM Aesthetic
**Decision:** Classic AOL Instant Messenger UI using 98.css + styled-components.
**Why:** Thematic alignment with the product concept (anonymous messaging, burning messages, retro privacy). Distinctive visual identity.
**Trade-off:** Accessibility limitations of the retro aesthetic (small fonts, low contrast in some areas). 98.css provides baseline accessibility.

---

## Appendix: Environment Configuration

### Dev Environment
```
Region:          us-east-1
Domain:          dev.burnware.live
RDS:             db.t3.micro, single-AZ, 20 GiB
EC2:             t3.micro, ASG 1/2/1
Multi-AZ:        No
Deletion Protection: No
Log Retention:   7 days
```

### Prod Environment
```
Region:          us-east-1
Domain:          burnware.live
RDS:             db.t3.micro, single-AZ, 20 GiB  (to be scaled)
EC2:             t3.micro, ASG 1/2/1  (to be scaled)
Multi-AZ:        No  (to be enabled)
Deletion Protection: No  (to be enabled)
Log Retention:   7 days
```

### Naming Convention

All resources follow: `burnware-{env}-{type}[-suffix]`

Examples:
- `burnware-dev-vpc`
- `burnware-dev-sg-alb`
- `burnware-dev-role-ec2`
- `/aws/burnware/dev/application`
- `burnware-dev-codedeploy-app`

### Tagging Strategy

| Tag | Value | Purpose |
|-----|-------|---------|
| `Application` | `BurnWare` | Cost allocation |
| `Environment` | `dev` / `prod` | Environment filtering |
| `ManagedBy` | `CDK` | IaC identification |
| `Tier` | `presentation` / `application` / `data` | Architecture tier |
