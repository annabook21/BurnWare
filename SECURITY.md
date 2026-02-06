# BurnWare Security Controls

## Implemented Security Controls

### 1. Input Validation (✓ Implemented)

**Location:** `app/src/middleware/validation-middleware.ts`

- All inputs validated using Joi schemas
- Schema definitions in `app/src/validators/`
- Validation happens before any business logic
- Automatic stripping of unknown fields

**Validators:**
- `link-validators.ts`: Link creation, updates, pagination
- `thread-validators.ts`: Thread operations
- `message-validators.ts`: Message sending, replies

**Validation Rules:**
- `link_id`: Alphanumeric, 8-16 chars
- `message`: 1-5000 chars, trimmed
- `display_name`: 1-100 chars
- `description`: Max 500 chars
- `expires_in_days`: Integer, 1-365

### 2. SQL Injection Prevention (✓ Implemented)

**Location:** All model files in `app/src/models/`

**Strategy:** Parameterized queries using `pg` library

**Example:**
```typescript
// SAFE - parameterized query
const query = 'SELECT * FROM threads WHERE link_id = $1';
const result = await this.db.query(query, [linkId]);

// NEVER DO THIS - string concatenation
const badQuery = `SELECT * FROM threads WHERE link_id = '${linkId}'`;
```

**All database queries use parameterized inputs:**
- `link-model.ts`: 7 queries, all parameterized
- `thread-model.ts`: 5 queries, all parameterized
- `message-model.ts`: 4 queries, all parameterized

### 3. XSS Protection (✓ Implemented)

**Location:** `app/src/server.ts` (Helmet middleware)

**Content Security Policy (CSP) Headers:**
```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
}
```

**Additional XSS Protection:**
- Helmet automatically sets `X-Content-Type-Options: nosniff`
- Helmet sets `X-Frame-Options: DENY`
- Helmet sets `X-XSS-Protection: 1; mode=block`

### 4. CSRF Protection (✓ Implemented)

**Strategy:** Multiple layers

1. **SameSite Cookies** (server.ts)
   - Configured via Helmet and Express session settings
   - Prevents cross-site cookie sending

2. **Origin/Referer Validation** (via CORS middleware)
   - Only allowed origins can make requests
   - Configured in `ALLOWED_ORIGINS` environment variable

3. **CAPTCHA for Anonymous Endpoints**
   - WAF CAPTCHA challenge for public endpoints
   - Rate limiting prevents automated attacks

### 5. Rate Limiting (✓ Implemented)

**Location:** `app/src/middleware/rate-limit-middleware.ts`

**Three Rate Limiting Layers:**

1. **WAF Rate Limiting (Primary)**
   - 10 requests per 5 minutes per IP for `/api/v1/send`
   - CAPTCHA challenge after threshold
   - Reference: https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-request-limiting.html

2. **Application Rate Limiting (Authenticated)**
   - 100 requests per 15 minutes per user
   - Tracks by Cognito user ID

3. **Strict Rate Limiting (Sensitive Operations)**
   - 10 requests per hour for link creation
   - Prevents abuse of resource creation

### 6. Authentication & Authorization (✓ Implemented)

**Location:** `app/src/middleware/auth-middleware.ts`

**JWT Validation:**
- Uses `aws-jwt-verify` library (AWS recommended)
- Validates signature against Cognito public keys
- Checks token expiration
- Verifies issuer matches User Pool
- Reference: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html

**Authorization Checks:**
- All link operations verify ownership
- Thread access requires link ownership
- Burn operations require ownership

### 7. Encryption (✓ Implemented)

**In Transit:**
- CloudFront: HTTPS via ACM certificate
- ALB: HTTPS listener with TLS 1.2+ (CDK: `SslPolicy.RECOMMENDED_TLS`)
- RDS: Force SSL via parameter `rds.force_ssl=1`
- VPC Endpoints: Encrypted within AWS network

**At Rest:**
- S3: Server-side encryption (SSE-S3)
- RDS: KMS encryption (customer-managed key)
- EBS: Encrypted volumes
- Secrets Manager: KMS encryption

### 8. Secure Token Generation (✓ Implemented)

**Location:** `app/src/utils/crypto-utils.ts`

- Uses `crypto.randomBytes()` for cryptographically secure tokens
- Link tokens: 12-byte base64url encoded (16 chars)
- HMAC for thread verification
- Anonymous IDs: SHA-256 hashed

### 9. Least Privilege IAM (✓ Implemented)

**Location:** `lib/constructs/security/iam-policy-factory.ts`

**EC2 Instance Role Permissions:**
- Secrets Manager: Specific secret ARNs only
- SSM Parameter Store: Specific parameter paths only
- S3: Deployment bucket with specific prefixes only
- CloudWatch Logs: Specific log group only
- X-Ray: Trace submission only
- Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html

### 10. Audit Logging (✓ Implemented)

**Structured Logging:**
- All operations logged to CloudWatch with JSON format
- Security events logged with severity levels
- Failed authentication attempts logged
- Rate limit violations logged

**Database Audit Log:**
- Schema includes `audit_log` table
- Tracks sensitive operations (link creation, thread burning)
- Stores event metadata and timestamps

## Security Best Practices Checklist

- [x] Input validation on all endpoints
- [x] Parameterized SQL queries (no string concatenation)
- [x] XSS protection via CSP headers
- [x] CSRF protection via SameSite cookies and origin validation
- [x] Rate limiting at WAF and application levels
- [x] JWT validation on authenticated endpoints
- [x] Encryption in transit (HTTPS everywhere)
- [x] Encryption at rest (RDS, S3, EBS)
- [x] Least-privilege IAM roles
- [x] Secure token generation
- [x] Audit logging for security events
- [x] No NAT Gateway (reduced attack surface)
- [x] Private subnets for compute and data tiers
- [x] Security groups with minimal required access
- [x] SSM Session Manager (no SSH/bastion)
- [x] Secrets Manager for credentials (no hardcoded secrets)

## References

- AWS IAM Best Practices: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
- RDS Encryption: https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/rds.html
- WAF Rate Limiting: https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-request-limiting.html
- Cognito JWT Verification: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
