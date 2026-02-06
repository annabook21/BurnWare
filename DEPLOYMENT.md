# BurnWare Deployment Guide

## Overview

This guide covers deploying BurnWare to AWS using CDK and following the NAT-free, production-ready architecture.

## Prerequisites

1. AWS Account with administrator access
2. AWS CLI configured: `aws configure`
3. Node.js 18+ installed
4. AWS CDK CLI: `npm install -g aws-cdk`
5. Domain name (optional, for custom domains)
6. ACM certificates (optional, for HTTPS with custom domain)

## Step-by-Step Deployment

### Step 1: Clone and Install

```bash
cd burnware
npm install
cd app && npm install && cd ..
```

### Step 2: Configure Environment

Create environment-specific configuration:

```bash
# Edit configuration
vi lib/config/environments/prod.ts
```

Update:
- AWS account ID
- Region
- Domain name
- Certificate ARN (if using custom domain)
- Alarm email

### Step 3: Bootstrap CDK

Bootstrap CDK in your AWS account (first time only):

```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1

cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}
```

### Step 4: Review Deployment Plan

```bash
# Synthesize CloudFormation templates
cdk synth --context environment=prod

# Review what will be created
cdk diff --context environment=prod --all
```

### Step 5: Deploy Infrastructure Stacks

Deploy stacks in order (dependencies are configured):

```bash
# Deploy all stacks
cdk deploy --all --context environment=prod --require-approval never

# Or deploy individually
cdk deploy BurnWare-Network-prod --context environment=prod
cdk deploy BurnWare-Auth-prod --context environment=prod
cdk deploy BurnWare-Data-prod --context environment=prod
cdk deploy BurnWare-WAF-prod --context environment=prod
cdk deploy BurnWare-App-prod --context environment=prod
cdk deploy BurnWare-Frontend-prod --context environment=prod
cdk deploy BurnWare-Observability-prod --context environment=prod
```

**Deployment Time:** ~30-40 minutes for all stacks

### Step 6: Build Base AMI

Create base AMI using EC2 Image Builder:

```bash
# Upload Image Builder components
aws s3 cp image-builder/components/ s3://your-components-bucket/ --recursive

# Create Image Builder pipeline via Console or CLI
# Reference: https://docs.aws.amazon.com/imagebuilder/

# Run pipeline to create base AMI
# Note: This takes ~20-30 minutes
```

### Step 7: Update AppStack with AMI

After AMI is created:

```bash
# Get AMI ID
AMI_ID=$(aws ec2 describe-images \
  --owners self \
  --filters "Name=name,Values=burnware-base-*" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

echo "AMI ID: $AMI_ID"

# Update config with AMI ID
# Then redeploy AppStack
cdk deploy BurnWare-App-prod --context environment=prod
```

### Step 8: Initialize Database

Connect to EC2 instance via SSM Session Manager:

```bash
# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=*burnware-asg*" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

# Start SSM session
aws ssm start-session --target $INSTANCE_ID

# In the session:
cd /opt/burnware
psql -h RDS_ENDPOINT -U postgres -d burnware -f database/schema.sql
```

### Step 9: Deploy Application Code

Build and package application:

```bash
cd app
npm run build

# Create deployment package
cd ..
tar -czf app-1.0.0.tar.gz app/dist app/package.json app/ecosystem.config.js

# Upload to S3 (via gateway endpoint)
aws s3 cp app-1.0.0.tar.gz s3://burnware-artifacts-prod/releases/

# Trigger CodeDeploy deployment
aws deploy create-deployment \
  --application-name burnware-codedeploy-app-prod \
  --deployment-group-name burnware-codedeploy-group-prod \
  --s3-location bucket=burnware-artifacts-prod,key=releases/app-1.0.0.tar.gz,bundleType=tgz \
  --description "Deploy version 1.0.0"

# Monitor deployment
aws deploy get-deployment --deployment-id d-XXXXXXXXX
```

### Step 10: Deploy Frontend

Build and deploy React SPA:

```bash
cd frontend
npm run build

# Sync to S3
aws s3 sync build/ s3://FRONTEND_BUCKET_NAME/

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

### Step 11: Configure DNS

Point your domain to CloudFront:

```bash
# Get CloudFront domain from outputs
CF_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name BurnWare-Frontend-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomain`].OutputValue' \
  --output text)

# Create CNAME or A record (alias) in Route 53 or your DNS provider
# burnware.example.com -> $CF_DOMAIN
```

### Step 12: Verify Deployment

```bash
# Check health endpoint
curl https://burnware.example.com/health

# Check CloudWatch dashboard
aws cloudwatch get-dashboard \
  --dashboard-name burnware-dashboard-prod

# Check alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix burnware-alarm-prod
```

## Post-Deployment Configuration

### Configure Cognito User Pool

1. Go to AWS Console → Cognito → User Pools
2. Select `burnware-user-pool-prod`
3. Configure email settings (SES or Cognito default)
4. Create initial admin user:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --temporary-password "TempPassword123!"
```

### Configure CloudWatch Alarms

Update alarm email subscriptions:

```bash
# Confirm SNS subscription from email
# Then add additional subscribers if needed

aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:burnware-alerts-prod \
  --protocol email \
  --notification-endpoint ops@example.com
```

### Enable CloudWatch Logs Insights

Pre-defined queries are available in the Console:

```
# Find errors in last hour
fields @timestamp, level, message, request_id
| filter level = "ERROR"
| sort @timestamp desc
| limit 100

# Calculate p95 latency
stats pct(latency_ms, 95) as p95_latency by endpoint
| filter method = "POST"
```

## Validation Tests

### Test VPC Endpoints

```bash
# SSH into instance via SSM
aws ssm start-session --target i-INSTANCE-ID

# Test S3 access (via gateway endpoint)
aws s3 ls

# Test Secrets Manager (via interface endpoint)
aws secretsmanager list-secrets --max-results 1

# Test CloudWatch Logs (via interface endpoint)
aws logs describe-log-groups --max-items 1

# Verify NO internet access (should timeout)
curl https://api.ipify.org --max-time 5
```

### Test Application

```bash
# Send anonymous message
curl -X POST https://burnware.example.com/api/v1/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_link_id": "abc123456789",
    "message": "Test message"
  }'

# Create link (authenticated)
curl -X POST https://burnware.example.com/api/v1/dashboard/links \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "My Test Link",
    "description": "Testing link creation"
  }'
```

## Troubleshooting

### EC2 Instances Not Healthy

1. Check CloudWatch Logs: `/aws/burnware/prod/application`
2. Check ALB target group health checks
3. Verify security group rules
4. Connect via SSM and check PM2 status: `pm2 status`

### Database Connection Issues

1. Verify security group allows EC2 → RDS on port 5432
2. Check RDS is in isolated subnets
3. Verify SSL is enforced: `rds.force_ssl=1`
4. Check Secrets Manager permissions

### VPC Endpoint Issues

1. Verify endpoints are in PRIVATE subnets
2. Check endpoint security groups allow HTTPS from EC2
3. Verify private DNS is enabled
4. Check route tables

### CodeDeploy Failures

1. Check deployment logs in CodeDeploy console
2. Verify S3 bucket is accessible via gateway endpoint
3. Check IAM instance role permissions
4. Review lifecycle hook scripts in CloudWatch Logs

## Rollback Procedures

### Rollback Application Deployment

```bash
# CodeDeploy auto-rollback is enabled
# Manual rollback:
aws deploy stop-deployment \
  --deployment-id d-XXXXXXXXX \
  --auto-rollback-enabled

# Or deploy previous version
aws deploy create-deployment \
  --application-name burnware-codedeploy-app-prod \
  --deployment-group-name burnware-codedeploy-group-prod \
  --s3-location bucket=burnware-artifacts-prod,key=releases/app-0.9.0.tar.gz,bundleType=tgz
```

### Rollback Infrastructure

```bash
# CDK does not support automatic rollback
# Manual rollback by redeploying previous version:

git checkout previous-tag
cdk deploy BurnWare-App-prod --context environment=prod
```

## Maintenance

### Update Security Patches

```bash
# Rebuild AMI with latest patches (weekly via Image Builder pipeline)
# Or manually:
aws imagebuilder start-image-pipeline-execution \
  --image-pipeline-arn arn:aws:imagebuilder:us-east-1:ACCOUNT:image-pipeline/burnware-base-ami
```

### Database Backups

- Automated backups: 7 days retention (configurable)
- Manual snapshot: AWS Console → RDS → Create Snapshot
- Point-in-time recovery enabled

### Rotate Secrets

```bash
# Rotate RDS credentials
aws secretsmanager rotate-secret \
  --secret-id burnware/db/credentials \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:ACCOUNT:function:SecretsManagerRotation
```

## References

- AWS CDK Documentation: https://docs.aws.amazon.com/cdk/
- Well-Architected Framework: https://docs.aws.amazon.com/wellarchitected/latest/framework/
- VPC Endpoints: https://docs.aws.amazon.com/vpc/latest/privatelink/
- SSM Session Manager: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html
