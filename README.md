# BurnWare - Anonymous Inbox System

Production-ready AWS implementation of BurnWare: private inbox with short links, QR codes, and expiring/burnable threads. Senders don’t need an account and we don’t store who they are (application-level anonymity only; not Tor-level — see ANONYMITY_RESEARCH.md).

## Architecture Overview

BurnWare implements a secure 3-tier architecture on AWS:

- **Presentation Tier**: CloudFront + S3 (SPA)
- **Application Tier**: ALB + EC2 Auto Scaling (private subnets, NAT-free)
- **Data Tier**: RDS PostgreSQL Multi-AZ (isolated subnets)

### Key Features

- ✅ HTTPS everywhere (ACM certificates)
- ✅ Cognito authentication for owners
- ✅ WAF with rate limiting + CAPTCHA for public API
- ✅ NAT-free architecture (VPC endpoints only)
- ✅ SSM Session Manager (no SSH/bastion)
- ✅ Structured JSON logging to CloudWatch
- ✅ AWS X-Ray distributed tracing
- ✅ Comprehensive CloudWatch alarms and dashboards
- ✅ **Every file under 500 lines** (professionally modularized)

## Project Structure

```
burnware/
├── bin/                    # CDK app entry point
├── lib/                    # CDK infrastructure code
│   ├── stacks/            # CDK stacks (7 stacks, all < 400 lines)
│   ├── constructs/        # Reusable constructs (factories)
│   ├── config/            # Environment configurations
│   └── utils/             # Utilities (naming, tagging)
├── app/                    # Node.js/TypeScript API
│   ├── src/
│   │   ├── config/        # App configuration
│   │   ├── routes/        # API routes
│   │   ├── controllers/   # HTTP handlers (< 250 lines each)
│   │   ├── services/      # Business logic (< 300 lines each)
│   │   ├── models/        # Data access (< 200 lines each)
│   │   ├── middleware/    # Express middleware
│   │   ├── validators/    # Joi schemas
│   │   └── utils/         # Utilities
│   └── tests/             # Integration tests
├── database/              # PostgreSQL schema
├── deployment/            # CodeDeploy scripts
└── image-builder/         # EC2 Image Builder components
```

## AWS Services Used

### Core Services
- **VPC**: Custom VPC with public, private, isolated subnets (2 AZs)
- **EC2**: Auto Scaling Group in private subnets
- **ALB**: Application Load Balancer with HTTPS
- **RDS**: PostgreSQL Multi-AZ with encryption
- **Cognito**: User Pool for authentication
- **CloudFront**: CDN for SPA delivery
- **S3**: Static asset hosting
- **WAF**: Web application firewall with rate limiting

### Supporting Services
- **VPC Endpoints**: S3 (gateway), SSM, CloudWatch Logs, Secrets Manager (interface)
- **ACM**: SSL/TLS certificates
- **CloudWatch**: Logs, dashboards, alarms
- **SNS**: Alarm notifications
- **Secrets Manager**: Database credentials
- **CodeDeploy**: Application deployments
- **EC2 Image Builder**: AMI baking
- **X-Ray**: Distributed tracing

## Prerequisites

- AWS CLI configured
- Node.js 18+ and npm
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS account with appropriate permissions

## Deployment

### 1. Install Dependencies

```bash
# CDK dependencies
npm install

# Application dependencies
cd app && npm install
```

### 2. Configure Environment

```bash
# Copy environment configuration
cp app/.env.example app/.env

# Edit with your values
vi app/.env
```

### 3. Bootstrap CDK (first time only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 4. Deploy Infrastructure

```bash
# Deploy to dev environment
cdk deploy --all --context environment=dev

# Deploy to production
cdk deploy --all --context environment=prod
```

### 5. Deploy Application

Build the application and deploy via CodeDeploy:

```bash
cd app
npm run build

# Create deployment package
tar -czf ../app-1.0.0.tar.gz .

# Upload to S3 (via deployment pipeline)
aws s3 cp ../app-1.0.0.tar.gz s3://burnware-artifacts-dev/releases/

# Trigger CodeDeploy deployment
aws deploy create-deployment \
  --application-name burnware-codedeploy-app-dev \
  --deployment-group-name burnware-codedeploy-group-dev \
  --s3-location bucket=burnware-artifacts-dev,key=releases/app-1.0.0.tar.gz,bundleType=tgz
```

### 6. Initialize Database

```bash
# Connect via SSM Session Manager
aws ssm start-session --target i-INSTANCE-ID

# Run schema migration
psql -h DB_ENDPOINT -U postgres -d burnware -f /opt/burnware/database/schema.sql
```

## Architecture Decisions

### NAT-Free Design

The architecture eliminates NAT Gateway for cost and security:

- **Cost Savings**: ~$32.40/month per AZ + data transfer charges eliminated
- **Security**: No internet access reduces attack surface
- **AWS Services**: Accessed via VPC endpoints (PrivateLink)

**VPC Endpoints Used:**
- S3 Gateway (no cost)
- SSM + SSMMessages + EC2Messages (Session Manager)
- CloudWatch Logs
- Secrets Manager
- CloudWatch Monitoring
- X-Ray

Reference: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-privatelink.html

### AMI Baking Strategy

EC2 Image Builder creates base AMIs with all dependencies pre-installed:

- Node.js 18+ and PM2
- PostgreSQL 15 client
- CloudWatch agent
- SSM agent
- X-Ray daemon

This enables instances to start without downloading packages, supporting the NAT-free architecture.

Reference: https://docs.aws.amazon.com/imagebuilder/

### Modular Code Organization

**Every file is under 500 lines** following AWS CDK best practices:

- Stacks orchestrate, constructs implement
- Factory pattern for reusable components
- Clear separation: stacks, constructs, config, utils
- TypeScript interfaces define all contracts

Reference: https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/organizing-code-best-practices.html

## Security

See [SECURITY.md](./SECURITY.md) for comprehensive security documentation.

**Key Security Features:**
- Input validation (Joi schemas)
- SQL injection prevention (parameterized queries)
- XSS protection (CSP headers)
- CSRF protection (SameSite cookies)
- Rate limiting (WAF + application)
- JWT validation (aws-jwt-verify)
- Encryption at rest and in transit
- Least-privilege IAM roles

## Monitoring

### CloudWatch Dashboard

Access via: AWS Console → CloudWatch → Dashboards → `burnware-dashboard-{env}`

**Metrics Tracked:**
- ALB response time (p50, p95, p99)
- Request count and error rates
- EC2 CPU utilization
- ASG healthy host count
- RDS CPU, connections, storage
- Custom application metrics

### CloudWatch Alarms

**Configured Alarms:**
- ALB 5xx rate > 5%
- Unhealthy hosts > 0
- EC2 CPU > 80%
- RDS CPU > 80%
- RDS storage < 10GB
- RDS connections > 80% of max
- ASG capacity < 2 instances

**Notifications:** SNS topic → Email/PagerDuty/Slack

## Management

### SSM Session Manager

Connect to EC2 instances without SSH:

```bash
# List instances
aws ec2 describe-instances --filters "Name=tag:Environment,Values=prod"

# Start session
aws ssm start-session --target i-INSTANCE-ID

# Session is audited in CloudTrail
```

Reference: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-privatelink.html

### CloudWatch Logs

View application logs:

```bash
# Via AWS CLI
aws logs tail /aws/burnware/dev/application --follow

# Via Logs Insights
# Query p95 latency by endpoint
stats pct(latency_ms, 95) as p95 by endpoint | filter method = "POST"
```

### CodeDeploy

Deploy new application versions:

```bash
# Create deployment
aws deploy create-deployment \
  --application-name burnware-codedeploy-app-prod \
  --deployment-group-name burnware-codedeploy-group-prod \
  --s3-location bucket=burnware-artifacts-prod,key=releases/app-1.2.0.tar.gz,bundleType=tgz
```

## API Documentation

### Public Endpoints (Unauthenticated)

```
POST /api/v1/send
- Send anonymous message to link
- Protected by WAF rate limiting + CAPTCHA

GET /api/v1/link/:link_id/metadata
- Get link display name and description

GET /health
- Health check endpoint
```

### Dashboard Endpoints (Authenticated)

```
POST /api/v1/dashboard/links
- Create new link

GET /api/v1/dashboard/links
- List all user links (paginated)

GET /api/v1/dashboard/threads/:thread_id
- Get thread with messages

POST /api/v1/dashboard/threads/:thread_id/burn
- Burn thread (delete messages)
```

## Cost Optimization

- No NAT Gateway: Saves ~$65/month (2 AZs)
- S3 Gateway endpoint: Free
- CloudFront caching: Reduces origin requests
- Auto Scaling: Right-sizing based on demand
- Reserved Instances: Consider for production RDS

## AWS Well-Architected Alignment

✅ **Operational Excellence**: IaC via CDK, automated monitoring
✅ **Security**: Encryption, least-privilege IAM, WAF, private subnets
✅ **Reliability**: Multi-AZ, Auto Scaling, automated backups
✅ **Performance**: CloudFront caching, Auto Scaling, RDS optimization
✅ **Cost Optimization**: NAT-free, right-sizing, S3 lifecycle policies
✅ **Sustainability**: Auto Scaling reduces idle capacity

Reference: https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html

## License

ISC
