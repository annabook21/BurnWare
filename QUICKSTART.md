# BurnWare Quick Start Guide

## 5-Minute Setup (Development)

### 1. Prerequisites

```bash
# Verify installations
node --version  # Should be 18+
npm --version
aws --version
cdk --version   # If not installed: npm install -g aws-cdk
```

### 2. Install Dependencies

```bash
# Root dependencies (CDK)
npm install

# Application dependencies
cd app && npm install && cd ..
```

### 3. Configure AWS

```bash
# Set AWS credentials
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1

# Or use AWS CLI profile
export AWS_PROFILE=default
```

### 4. Bootstrap CDK (First Time Only)

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1

cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}
```

### 5. Deploy to Dev Environment

```bash
# Deploy all stacks (takes ~30 minutes)
cdk deploy --all --context environment=dev

# Or deploy individually
cdk deploy BurnWare-Network-dev BurnWare-Auth-dev BurnWare-Data-dev --context environment=dev
```

### 6. Get Outputs

```bash
# Get ALB DNS name
aws cloudformation describe-stacks \
  --stack-name BurnWare-App-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
  --output text

# Get Cognito User Pool ID
aws cloudformation describe-stacks \
  --stack-name BurnWare-Auth-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text
```

### 7. Initialize Database

```bash
# Get EC2 instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=*burnware-asg-dev*" \
  "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

# Connect via SSM
aws ssm start-session --target $INSTANCE_ID

# In the session, run:
# (Get DB endpoint from stack outputs)
psql -h DB_ENDPOINT -U postgres -d burnware < /opt/burnware/database/schema.sql
```

### 8. Test API

```bash
# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name BurnWare-App-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
  --output text)

# Test health check
curl http://${ALB_DNS}/health

# Expected: {"data":{"status":"healthy","timestamp":"..."}}
```

### 9. Create Test User

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name BurnWare-Auth-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com \
  --user-attributes Name=email,Value=test@example.com \
  --temporary-password "TempPass123!"
```

### 10. Deploy Frontend (Optional)

```bash
cd frontend
npm install
npm run build

# Get bucket name from outputs
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name BurnWare-Frontend-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

aws s3 sync dist/ s3://${BUCKET}/
```

## Verify Deployment

### Check All Stacks

```bash
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `BurnWare`)].StackName'

# Should show 7 stacks:
# - BurnWare-Network-dev
# - BurnWare-Auth-dev
# - BurnWare-Data-dev
# - BurnWare-WAF-dev
# - BurnWare-App-dev
# - BurnWare-Frontend-dev
# - BurnWare-Observability-dev
```

### Check VPC Endpoints

```bash
# List VPC endpoints
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=VPC_ID" \
  --query 'VpcEndpoints[].ServiceName'

# Should show 8 endpoints:
# - com.amazonaws.us-east-1.s3 (gateway)
# - com.amazonaws.us-east-1.ssm
# - com.amazonaws.us-east-1.ssmmessages
# - com.amazonaws.us-east-1.ec2messages
# - com.amazonaws.us-east-1.logs
# - com.amazonaws.us-east-1.secretsmanager
# - com.amazonaws.us-east-1.monitoring
# - com.amazonaws.us-east-1.xray
```

### Check CloudWatch Alarms

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix burnware-alarm-dev \
  --query 'MetricAlarms[].AlarmName'

# Should show 7 alarms configured
```

### Check Auto Scaling Group

```bash
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names burnware-asg-dev \
  --query 'AutoScalingGroups[0].[MinSize,DesiredCapacity,MaxSize]'

# Should show [1, 1, 2] for dev
```

## Cleanup

To destroy all resources:

```bash
# WARNING: This deletes everything
cdk destroy --all --context environment=dev --force

# Or selectively
cdk destroy BurnWare-Observability-dev --context environment=dev
cdk destroy BurnWare-Frontend-dev --context environment=dev
cdk destroy BurnWare-App-dev --context environment=dev
cdk destroy BurnWare-WAF-dev --context environment=dev
cdk destroy BurnWare-Data-dev --context environment=dev
cdk destroy BurnWare-Auth-dev --context environment=dev
cdk destroy BurnWare-Network-dev --context environment=dev
```

## Common Issues

### "Stack already exists"
Solution: Use `cdk deploy --force` or delete the stack first

### "No default VPC found"
Solution: This is normal - we create a custom VPC

### "Certificate not found"
Solution: Update `certificateArn` in config or remove for HTTP-only dev

### "Database connection failed"
Solution: Check security group rules and RDS endpoint

## Production Deployment

For production, see [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guide.

Key differences:
- Use production configuration
- Enable Multi-AZ for RDS
- Enable deletion protection
- Configure custom domain and ACM certificates
- Set up monitoring alerts to ops email
- Configure backups and retention

## Development Workflow

```bash
# Make changes to infrastructure
vi lib/stacks/app-stack.ts

# Check what will change
cdk diff BurnWare-App-dev --context environment=dev

# Deploy changes
cdk deploy BurnWare-App-dev --context environment=dev

# Make changes to application
cd app
vi src/services/link-service.ts

# Build and test locally
npm run build
npm test

# Deploy via CodeDeploy (see DEPLOYMENT.md)
```

## File Size Verification

All files are under 500 lines:

```bash
npm run lint:file-size

# Or manually:
find lib app/src -name '*.ts' -exec wc -l {} + | awk '$1 > 500 {print "ERROR: "$2" has "$1" lines"; exit 1}' && echo "✓ All files under 500 lines"
```

## Architecture Validation

Verify the NAT-free architecture:

```bash
# Connect to EC2 via SSM
aws ssm start-session --target INSTANCE_ID

# Try to access internet (should fail/timeout)
curl https://api.ipify.org --max-time 5

# Verify VPC endpoint access works
aws s3 ls
aws secretsmanager list-secrets --max-results 1
aws logs describe-log-groups --max-items 1

# All AWS commands should work via VPC endpoints ✓
```

## Success Criteria

- [ ] All 7 CDK stacks deployed successfully
- [ ] EC2 instances are healthy in target group
- [ ] RDS instance is available
- [ ] VPC endpoints are active
- [ ] CloudWatch dashboard shows metrics
- [ ] Health check endpoint returns 200 OK
- [ ] SSM Session Manager connects to EC2
- [ ] No NAT Gateway in VPC (verify in console)
- [ ] All files under 500 lines (run lint:file-size)

## Time Estimates

- Initial setup: 5 minutes
- CDK bootstrap: 5 minutes
- Infrastructure deployment: 30 minutes
- AMI building: 20 minutes
- Application deployment: 10 minutes
- **Total: ~70 minutes for complete setup**

## Get Help

- Check [README.md](./README.md) for overview
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture details
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment steps
- Read [SECURITY.md](./SECURITY.md) for security controls
- See [MODULARIZATION.md](./MODULARIZATION.md) for code organization
