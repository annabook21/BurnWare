# BurnWare EC2 Image Builder Components

These Image Builder components are used to create base AMIs with all required dependencies pre-installed, enabling a NAT-free architecture.

## Components

### 1. base-dependencies.yaml
- Node.js and NPM
- PM2 process manager
- PostgreSQL 15 client
- CloudWatch agent
- SSM agent
- System utilities (jq, curl, tar)

### 2. xray-daemon.yaml
- AWS X-Ray daemon for distributed tracing
- Reference: https://docs.aws.amazon.com/xray/latest/devguide/xray-daemon-ec2.html

### 3. security-hardening.yaml
- SSH hardening
- Disable unused services
- Secure file permissions

## Usage with CDK

These components should be referenced in an EC2 Image Builder pipeline:

```typescript
import * as imagebuilder from 'aws-cdk-lib/aws-imagebuilder';

const pipeline = new imagebuilder.CfnImagePipeline(this, 'Pipeline', {
  name: 'burnware-base-ami',
  imageRecipeArn: recipe.attrArn,
  infrastructureConfigurationArn: infraConfig.attrArn,
  schedule: {
    scheduleExpression: 'cron(0 0 ? * sun *)', // Weekly on Sunday
  },
});
```

## Build Process

1. Start with Amazon Linux 2023 base image
2. Apply base-dependencies component
3. Apply xray-daemon component
4. Apply security-hardening component
5. Run validation tests
6. Create AMI
7. Distribute to application regions

## Reference

- EC2 Image Builder: https://docs.aws.amazon.com/imagebuilder/
- Migration from Packer: https://aws.amazon.com/blogs/mt/migrating-from-hashicorp-packer-to-ec2-image-builder
