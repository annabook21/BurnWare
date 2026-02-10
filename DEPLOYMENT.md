# Deployment Guide

## Prerequisites

- Node.js >= 20
- AWS CLI configured (`aws configure` or `AWS_PROFILE`)
- AWS CDK CLI: `npm install -g aws-cdk`

## 1. Install Dependencies

```bash
npm install
cd app && npm install && cd ..
cd frontend && npm install && cd ..
```

## 2. Bootstrap CDK (First Time Only)

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1

cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}
```

## 3. Configure Environment

Edit `lib/config/environments/dev.ts` or `prod.ts`:
- AWS account ID and region
- Domain name and certificate ARN (optional)
- Alarm notification email

## 4. Deploy Infrastructure

```bash
# Preview changes
cdk diff --all --context environment=dev

# Deploy all 8 stacks (~30 minutes)
cdk deploy --all --context environment=dev

# Or deploy individually
cdk deploy BurnWare-Network-dev --context environment=dev
cdk deploy BurnWare-Auth-dev --context environment=dev
# ... etc (dependencies are configured, CDK handles ordering)
```

WAF stack always deploys to us-east-1 (CloudFront requirement).

## 5. Initialize Database

```bash
# Connect via SSM Session Manager (no SSH needed)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=*burnware-asg-dev*" \
  "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

aws ssm start-session --target $INSTANCE_ID

# In the session, run the schema:
psql -h <RDS_ENDPOINT> -U postgres -d burnware -f /opt/burnware/database/schema.sql
```

## 6. Deploy Backend

```bash
cd app
npm ci && npm run build && npm prune --omit=dev

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

`node_modules` must be bundled in the artifact since EC2 instances have no internet access (NAT-free).

## 7. Deploy Frontend

The Frontend stack builds and deploys the React SPA automatically via CDK:

```bash
cdk deploy BurnWare-Frontend-dev --context environment=dev
```

Or manually:

```bash
cd frontend && npm run build
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name BurnWare-Frontend-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)
aws s3 sync dist/ s3://${BUCKET}/
```

## 8. Create First User

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name BurnWare-Auth-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --temporary-password "TempPass123!"
```

## Verification

```bash
# Health check
curl https://<domain>/health

# Check all stacks deployed
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `BurnWare`)].StackName'

# Verify NAT-free (from SSM session, should timeout)
curl https://api.ipify.org --max-time 5

# Verify VPC endpoint access (from SSM session, should succeed)
aws s3 ls
aws secretsmanager list-secrets --max-results 1
```

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| EC2 unhealthy in target group | App not running or health check failing | SSM in, check `pm2 status` and CloudWatch logs |
| Database connection failed | Security group or SSL config | Verify EC2 SG → RDS SG on port 5432, check `rds.force_ssl=1` |
| CodeDeploy failure | Artifact structure or IAM | Check `appspec.yml` is at tarball root, verify S3 GetObject permission |
| VPC endpoint not working | Security group or private DNS | Verify endpoint SG allows TCP 443 from EC2 SG, check private DNS enabled |
| `dnf install` hangs on EC2 | IPv6 resolution to S3 dualstack | User data should set `ip_resolve=4` in `/etc/dnf/dnf.conf` |

## Rollback

CodeDeploy auto-rollback is enabled on failure. Manual rollback:

```bash
# Deploy a previous artifact version
aws deploy create-deployment \
  --application-name burnware-dev-codedeploy-app \
  --deployment-group-name burnware-dev-codedeploy-group \
  --s3-location bucket=burnware-dev-deployments,key=releases/app-previous.tar.gz,bundleType=tgz
```

For infrastructure rollback, revert the code and redeploy via CDK.

## Cleanup

```bash
# Destroy all resources (reverse dependency order)
cdk destroy --all --context environment=dev --force
```
