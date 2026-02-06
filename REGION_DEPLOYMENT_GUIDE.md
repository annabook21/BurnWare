# BurnWare Region Deployment Guide

## ✅ US-EAST-1 Deployment - FULLY SUPPORTED

**Yes, BurnWare is 100% deployable to us-east-1 and it's the default region!**

---

## Region Configuration

### Default Region: us-east-1

**Configuration Location:** `lib/config/environments/dev.ts` and `prod.ts`

```typescript
env: {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1', // ✅ Default
}
```

### Stack-Specific Regions

**Most Stacks:** Use configured region (us-east-1)
- NetworkStack ✅
- AuthStack ✅
- DataStack ✅
- AppStack ✅
- ObservabilityStack ✅
- FrontendStack ✅

**WAF Stack:** MUST be in us-east-1 for CloudFront ✅
```typescript
// bin/burnware.ts line 56
env: { ...config.env, region: 'us-east-1' },
```

**Why:** CloudFront is a global service, but its WAF must be in us-east-1.
Reference: https://docs.aws.amazon.com/waf/latest/developerguide/cloudfront-features.html

---

## Deployment to us-east-1

### Prerequisites

```bash
# Set environment variables
export AWS_REGION=us-east-1
export CDK_DEFAULT_REGION=us-east-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
```

### Bootstrap (First Time)

```bash
cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/us-east-1
```

### Deploy

```bash
# Development
cdk deploy --all --context environment=dev

# Production
cdk deploy --all --context environment=prod
```

**The stacks will deploy to us-east-1 automatically!**

---

## Service Availability in us-east-1

All AWS services used by BurnWare are available in us-east-1:

### Compute & Networking
✅ **VPC** - Available
✅ **EC2** - Available (all instance types)
✅ **Auto Scaling** - Available
✅ **Elastic Load Balancing (ALB)** - Available
✅ **VPC Endpoints** - All endpoint services available

### Storage & Database
✅ **S3** - Available (primary region)
✅ **RDS PostgreSQL** - Available (all versions)

### Security & Identity
✅ **Cognito** - Available
✅ **WAF** - Available (required for CloudFront)
✅ **ACM (Certificate Manager)** - Available
✅ **Secrets Manager** - Available
✅ **IAM** - Global service

### Content Delivery
✅ **CloudFront** - Global service (controlled from us-east-1)

### Developer Tools
✅ **CodeDeploy** - Available
✅ **EC2 Image Builder** - Available

### Management & Monitoring
✅ **CloudWatch** (Logs, Alarms, Dashboards) - Available
✅ **X-Ray** - Available
✅ **Systems Manager** - Available
✅ **SNS** - Available
✅ **CloudTrail** - Available

**All 20 AWS services are fully available in us-east-1! ✅**

---

## Why us-east-1 is Ideal

### Advantages

1. **CloudFront Requirement**
   - CloudFront WAF must be in us-east-1
   - Already configured correctly in our code

2. **Service Availability**
   - All AWS services available
   - Latest features typically launch here first
   - Most mature region

3. **Cost Efficiency**
   - Often lowest pricing
   - No cross-region data transfer for most services

4. **ACM Certificates for CloudFront**
   - Must be in us-east-1
   - Already configured correctly

5. **Documentation Examples**
   - Most AWS docs use us-east-1 examples
   - Easier to follow guides

### No Disadvantages

- All required services available
- No latency issues (multi-AZ within region)
- CloudFront provides global edge caching anyway

---

## Multi-Region Deployment (Optional)

If you want to deploy to other regions later:

### Step 1: Update Configuration

```typescript
// lib/config/environments/prod-west.ts
export const prodWestConfig: EnvironmentConfig = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-west-2', // Different region
  },
  // ... other config
};
```

### Step 2: Deploy Backend Stacks

```bash
# Backend stacks can go to any region
export CDK_DEFAULT_REGION=us-west-2
cdk deploy BurnWare-Network-prod-west --context environment=prod-west
```

### Step 3: Keep WAF in us-east-1

```typescript
// WAF MUST stay in us-east-1 for CloudFront
const wafStack = new WafStack(app, 'BurnWare-WAF-prod-west', {
  env: { account: config.env.account, region: 'us-east-1' }, // ✅ Force us-east-1
  scope: 'CLOUDFRONT',
});
```

### Important Notes

**CloudFront + WAF Constraint:**
- CloudFront is global, but WAF must be us-east-1
- This is an AWS requirement, not a limitation of our code
- Already handled correctly in `bin/burnware.ts` line 56

**Regional Services:**
- VPC, EC2, RDS are regional (deploy to target region)
- Cognito is regional (deploy to target region)
- S3 buckets are regional
- CloudWatch is regional

**Global Services:**
- CloudFront (global, controlled from us-east-1)
- IAM (global)
- Route 53 (global)

---

## VPC Endpoint Availability

All VPC endpoints used are available in us-east-1:

```
✅ com.amazonaws.us-east-1.s3 (Gateway)
✅ com.amazonaws.us-east-1.ssm (Interface)
✅ com.amazonaws.us-east-1.ssmmessages (Interface)
✅ com.amazonaws.us-east-1.ec2messages (Interface)
✅ com.amazonaws.us-east-1.logs (Interface)
✅ com.amazonaws.us-east-1.secretsmanager (Interface)
✅ com.amazonaws.us-east-1.monitoring (Interface)
✅ com.amazonaws.us-east-1.xray (Interface)
```

Reference: https://docs.aws.amazon.com/vpc/latest/privatelink/aws-services-privatelink-support.html

---

## Deployment Command for us-east-1

### Single Command Deploy

```bash
# Set region explicitly
export AWS_REGION=us-east-1
export CDK_DEFAULT_REGION=us-east-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

# Bootstrap (first time only)
cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/us-east-1

# Deploy everything
cdk deploy --all --context environment=dev

# Or production
cdk deploy --all --context environment=prod
```

**Everything will deploy to us-east-1! ✅**

---

## Verification After Deployment

### Check Region

```bash
# Verify all stacks are in us-east-1
aws cloudformation list-stacks \
  --region us-east-1 \
  --query 'StackSummaries[?contains(StackName, `BurnWare`)].StackName'

# Should show 7 stacks:
# BurnWare-Network-dev
# BurnWare-Auth-dev
# BurnWare-Data-dev
# BurnWare-WAF-dev
# BurnWare-App-dev
# BurnWare-Frontend-dev
# BurnWare-Observability-dev
```

### Check VPC Endpoints

```bash
# Get VPC ID
VPC_ID=$(aws ec2 describe-vpcs \
  --region us-east-1 \
  --filters "Name=tag:Name,Values=*burnware-vpc-dev*" \
  --query 'Vpcs[0].VpcId' \
  --output text)

# List VPC endpoints
aws ec2 describe-vpc-endpoints \
  --region us-east-1 \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'VpcEndpoints[].ServiceName'

# Should show 8 endpoints (all in us-east-1)
```

### Check RDS Instance

```bash
aws rds describe-db-instances \
  --region us-east-1 \
  --query 'DBInstances[?contains(DBInstanceIdentifier, `burnware`)].{ID:DBInstanceIdentifier,AZ:AvailabilityZone,MultiAZ:MultiAZ}'
```

---

## Region-Specific Considerations

### ACM Certificates

**For ALB (Regional):**
- Certificate must be in same region as ALB
- If deploying to us-east-1, request cert in us-east-1 ✅

**For CloudFront (Global):**
- Certificate MUST be in us-east-1 (AWS requirement)
- Already configured correctly ✅

### Cognito

- Cognito User Pool is regional
- Will be created in us-east-1
- JWT issuer URL will be: `https://cognito-idp.us-east-1.amazonaws.com/{pool-id}`

### RDS

- RDS instance is regional (us-east-1)
- Multi-AZ spans multiple availability zones within us-east-1
- Automated backups stored in us-east-1

### S3

- Frontend bucket in us-east-1
- Accessed globally via CloudFront
- Artifacts bucket in us-east-1

---

## Cost in us-east-1

**Monthly Estimate (Development):**

| Service | Cost |
|---------|------|
| EC2 (t3.micro × 1-2) | ~$15 |
| RDS (db.t3.micro) | ~$20 |
| ALB | ~$22 |
| VPC Endpoints (7 × $7.30) | ~$51 |
| S3 | ~$5 |
| CloudWatch | ~$5 |
| Other | ~$12 |
| **Total** | **~$130/month** |

**Savings:**
- NAT Gateway NOT used: Save $32.40/month per AZ = ~$65/month
- S3 Gateway Endpoint: Free

**Net: ~$140/month with significant NAT savings**

Pricing in us-east-1 is typically the lowest across all regions.

---

## Troubleshooting

### Issue: "Region not specified"

**Solution:**
```bash
export AWS_REGION=us-east-1
export CDK_DEFAULT_REGION=us-east-1
```

### Issue: "VPC endpoint service not available"

**Check availability:**
```bash
aws ec2 describe-vpc-endpoint-services \
  --region us-east-1 \
  --query 'ServiceNames' | grep ssm
```

All services should be available in us-east-1.

### Issue: "Certificate not found in us-east-1"

**For ALB:** Request certificate in us-east-1
**For CloudFront:** Certificate MUST be in us-east-1 (AWS requirement)

```bash
# Request ACM certificate
aws acm request-certificate \
  --region us-east-1 \
  --domain-name burnware.example.com \
  --validation-method DNS
```

---

## Summary

### ✅ Fully Deployable to us-east-1

**Configuration:**
- Default region: us-east-1 ✅
- All services available ✅
- VPC endpoints available ✅
- WAF correctly configured for CloudFront ✅
- No region conflicts ✅

**Deployment Command:**
```bash
cdk deploy --all --context environment=dev
```

**That's it! The region is already configured correctly.**

---

## Additional Regions (If Needed)

BurnWare can also deploy to these regions with all services available:
- us-west-2 (Oregon)
- us-west-1 (N. California)
- eu-west-1 (Ireland)
- ap-southeast-1 (Singapore)

Simply change `CDK_DEFAULT_REGION` environment variable.

**Note:** WAF must always stay in us-east-1 for CloudFront (AWS requirement).

---

**Ready to deploy to us-east-1 right now! 🚀**
