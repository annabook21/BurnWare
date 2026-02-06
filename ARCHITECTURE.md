# BurnWare Architecture Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION TIER                            │
│  ┌────────────┐         ┌─────────────┐         ┌──────────────┐   │
│  │ CloudFront │ ◄────── │     S3      │ ◄────── │  WAF WebACL  │   │
│  │    (CDN)   │         │ (SPA Assets)│         │ (Rate Limit) │   │
│  └────────────┘         └─────────────┘         └──────────────┘   │
│         │                                                             │
│         │ HTTPS                                                       │
└─────────┼─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION TIER                              │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    Public Subnets (2 AZs)                  │     │
│  │  ┌──────────────────────────────────────────────────────┐  │     │
│  │  │ Application Load Balancer (ALB)                      │  │     │
│  │  │ - HTTPS Listener (ACM Certificate)                   │  │     │
│  │  │ - Target Group (port 3000)                           │  │     │
│  │  └──────────────────────────────────────────────────────┘  │     │
│  └─────────────────────┬──────────────────────────────────────┘     │
│                        │                                             │
│  ┌─────────────────────▼──────────────────────────────────────┐     │
│  │                Private Subnets (2 AZs)                     │     │
│  │  ┌──────────────────────────────────────────────────────┐  │     │
│  │  │ EC2 Auto Scaling Group (NAT-FREE)                    │  │     │
│  │  │ ┌─────────┐  ┌─────────┐  ┌─────────┐              │  │     │
│  │  │ │ EC2 (1) │  │ EC2 (2) │  │ EC2 (n) │              │  │     │
│  │  │ │ Node.js │  │ Node.js │  │ Node.js │              │  │     │
│  │  │ │ + X-Ray │  │ + X-Ray │  │ + X-Ray │              │  │     │
│  │  │ └─────────┘  └─────────┘  └─────────┘              │  │     │
│  │  └──────────────────────────────────────────────────────┘  │     │
│  └─────────────────────┬──────────────────────────────────────┘     │
│                        │                                             │
│  ┌─────────────────────▼──────────────────────────────────────┐     │
│  │              VPC Endpoints (Interface)                     │     │
│  │  - SSM + SSMMessages + EC2Messages (Session Manager)       │     │
│  │  - CloudWatch Logs (Logging)                               │     │
│  │  - Secrets Manager (Credentials)                           │     │
│  │  - CloudWatch Monitoring (Metrics)                         │     │
│  │  - X-Ray (Tracing)                                         │     │
│  │                                                             │     │
│  │              S3 Gateway Endpoint (No Cost)                 │     │
│  │  - Application artifact downloads                          │     │
│  │  - Log archival                                            │     │
│  └─────────────────────────────────────────────────────────────┘     │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           DATA TIER                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │               Isolated Subnets (2 AZs)                     │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ RDS PostgreSQL Multi-AZ                              │  │    │
│  │  │ - Encryption at rest (KMS)                           │  │    │
│  │  │ - Force SSL (rds.force_ssl=1)                        │  │    │
│  │  │ - Automated backups (7-35 days)                      │  │    │
│  │  │ - No public access                                   │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

                    OBSERVABILITY (Cross-Cutting)
┌─────────────────────────────────────────────────────────────────────┐
│  CloudWatch Logs     CloudWatch Alarms     CloudWatch Dashboard     │
│  X-Ray Tracing       SNS Notifications     CloudTrail Audit         │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Anonymous Message Sending

1. User visits `https://burnware.example.com/l/{link_id}` (CloudFront)
2. SPA loaded from S3 via CloudFront
3. User submits message → `POST /api/v1/send` → CloudFront → WAF
4. WAF checks rate limit, may present CAPTCHA
5. Request forwarded to ALB → EC2 instance
6. EC2 validates input, checks link in RDS (via private network)
7. Creates thread and message in RDS
8. Returns thread ID to user
9. All operations logged to CloudWatch, traced by X-Ray

### Owner Dashboard Access

1. Owner visits `https://burnware.example.com/dashboard` (CloudFront)
2. Cognito hosted UI for authentication (or custom auth flow)
3. Receives JWT access token
4. Dashboard API calls include `Authorization: Bearer {token}`
5. ALB → EC2 validates JWT using Cognito public keys
6. Authorized requests access RDS data
7. Returns paginated results

### Thread Burning

1. Owner clicks "Burn" on thread
2. `POST /api/v1/dashboard/threads/{id}/burn` with JWT
3. EC2 validates JWT, verifies ownership
4. Deletes all messages, marks thread as burned
5. Audit log entry created
6. Security event logged to CloudWatch

## Network Architecture Details

### Subnet Configuration

**Public Subnets (10.0.0.0/24, 10.0.1.0/24)**
- ALB only
- Internet Gateway attached
- Route: 0.0.0.0/0 → IGW

**Private Subnets (10.0.10.0/24, 10.0.11.0/24)**
- EC2 Auto Scaling Group
- VPC Interface Endpoints
- NO NAT Gateway
- Routes: VPC endpoints only

**Isolated Subnets (10.0.20.0/24, 10.0.21.0/24)**
- RDS PostgreSQL
- NO routes to internet
- NO NAT Gateway

### Security Group Rules

**ALB Security Group:**
- Ingress: 0.0.0.0/0 → 443 (HTTPS)
- Egress: EC2 SG → 3000 (Application)

**EC2 Security Group:**
- Ingress: ALB SG → 3000
- Egress: RDS SG → 5432 (PostgreSQL)
- Egress: VPC Endpoint SG → 443 (AWS Services)

**RDS Security Group:**
- Ingress: EC2 SG → 5432
- Egress: NONE

**VPC Endpoint Security Group:**
- Ingress: EC2 SG → 443
- Egress: NONE

## High Availability

- **Multi-AZ Deployment**: ALB, ASG, RDS across 2+ AZs
- **Auto Scaling**: Scales based on CPU and request count
- **Health Checks**: ALB health checks on `/health` endpoint
- **Automated Failover**: RDS Multi-AZ automatic failover
- **Backup & Recovery**: RDS automated backups + point-in-time recovery

## Security Architecture

### Defense in Depth

**Layer 1 - Edge:** CloudFront + WAF (rate limiting, CAPTCHA, managed rules)
**Layer 2 - Network:** Security groups, private subnets, no internet access
**Layer 3 - Application:** Input validation, JWT authentication, CSP headers
**Layer 4 - Data:** RDS encryption, parameterized queries, audit logging
**Layer 5 - IAM:** Least-privilege roles, specific ARN restrictions

### Compliance Features

- Audit logging (all sensitive operations)
- Encryption at rest (RDS, S3, EBS)
- Encryption in transit (HTTPS, SSL/TLS)
- Access logging (ALB, CloudFront, CloudTrail)
- Session recording (SSM Session Manager)

## Cost Breakdown (Monthly Estimate)

**Compute:**
- EC2 t3.micro × 2 (ASG): ~$15
- ALB: ~$22

**Database:**
- RDS db.t3.micro Multi-AZ: ~$40

**Storage:**
- S3 (frontend + artifacts): ~$5
- EBS (EC2 volumes): ~$5
- RDS storage (20GB): ~$5

**Network:**
- CloudFront data transfer: ~$20 (varies)
- VPC Interface Endpoints: ~$22 (7 endpoints × $0.01/hour × 730 hours)

**Other:**
- Secrets Manager: ~$1
- CloudWatch Logs: ~$5

**Total: ~$140/month** (excluding data transfer)

**Cost Savings from NAT-Free:**
- NAT Gateway: ~$65/month saved (2 AZs × $32.40/month)
- NAT data transfer: Variable savings

## Scaling Considerations

### Horizontal Scaling

- **EC2 Auto Scaling**: Add more instances (up to maxCapacity)
- **RDS Read Replicas**: Add for read-heavy workloads
- **CloudFront**: Automatic global scaling

### Vertical Scaling

- **EC2**: Change instance type in launch template
- **RDS**: Modify instance class (requires downtime)

### Database Scaling

- **Connection Pooling**: Configured in application (max 20)
- **Read Replicas**: For read-heavy workloads
- **Parameter Tuning**: Optimize for workload

## Disaster Recovery

### RTO/RPO Targets

- **RPO**: < 5 minutes (automated backups + transaction logs)
- **RTO**: < 30 minutes (automated failover + ASG)

### Backup Strategy

- **RDS Automated Backups**: Daily + transaction logs
- **RDS Manual Snapshots**: Before major changes
- **S3 Versioning**: Frontend assets
- **Infrastructure as Code**: CDK enables infrastructure recreation

### Recovery Procedures

1. RDS failover: Automatic in Multi-AZ
2. Complete region failure: Restore from snapshot in new region
3. Data corruption: Point-in-time recovery
4. Infrastructure destruction: Redeploy via CDK

## References

- Well-Architected Framework: https://docs.aws.amazon.com/wellarchitected/latest/framework/
- VPC Endpoints: https://docs.aws.amazon.com/vpc/latest/privatelink/
- ALB Best Practices: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/
- RDS Best Practices: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/
- CDK Best Practices: https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/
