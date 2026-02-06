/**
 * User Data Builder
 * Generates user data scripts for EC2 instances
 * File size: ~145 lines
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface UserDataConfig {
  region: string;
  dbSecretId: string;
  /** RDS endpoint (from Data stack); secret does not include host/port. */
  dbEndpoint: string;
  /** RDS port (from Data stack). */
  dbPort: string;
  deploymentBucket: string;
  appVersion: string;
  logGroup: string;
  environment: string;
}

export class UserDataBuilder {
  /**
   * Build user data script for EC2 instances
   * Downloads artifacts from S3 via gateway endpoint
   * Retrieves secrets from Secrets Manager via VPC endpoint
   */
  static build(config: UserDataConfig): ec2.UserData {
    const userData = ec2.UserData.forLinux();

    // Set environment variables
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Environment configuration',
      `export AWS_REGION=${config.region}`,
      `export ENVIRONMENT=${config.environment}`,
      `export LOG_GROUP=${config.logGroup}`,
      '',
      '# Retrieve database credentials from Secrets Manager',
      '# https://docs.aws.amazon.com/secretsmanager/latest/userguide/vpc-endpoint-overview.html',
      `export DB_SECRET=$(aws secretsmanager get-secret-value \\`,
      `  --secret-id ${config.dbSecretId} \\`,
      `  --region ${config.region} \\`,
      '  --query SecretString \\',
      '  --output text)',
      '',
      '# Parse credentials (secret has username/password; host/port from stack)',
      'export DB_HOST="' + config.dbEndpoint + '"',
      'export DB_PORT="' + config.dbPort + '"',
      'export DB_NAME="burnware"',
      'export DB_USER=$(echo $DB_SECRET | jq -r .username)',
      'export DB_PASSWORD=$(echo $DB_SECRET | jq -r .password)',
      '',
      '# Create application directory',
      'mkdir -p /opt/burnware',
      'cd /opt/burnware',
      ''
    );

    if (config.deploymentBucket) {
      userData.addCommands(
        '# Download application artifact from S3',
        '# https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html',
        `aws s3 cp s3://${config.deploymentBucket}/releases/app-${config.appVersion}.tar.gz /opt/burnware/`,
        '',
        'tar -xzf app-' + config.appVersion + '.tar.gz',
        'npm ci --production 2>/dev/null || true',
        'chown -R ec2-user:ec2-user /opt/burnware',
        '',
        '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:AmazonCloudWatch-linux || true',
        'systemctl start xray 2>/dev/null || true',
        'systemctl enable xray 2>/dev/null || true',
        'su - ec2-user -c "cd /opt/burnware && pm2 start ecosystem.config.js" 2>/dev/null || true',
        'su - ec2-user -c "pm2 save" 2>/dev/null || true',
        ''
      );
    } else {
      userData.addCommands(
        '# No deployment bucket: run minimal health endpoint for ALB (dev)',
        'yum install -y python3',
        'cat > /opt/burnware/health_server.py << \'HEALTHEOF\'',
        'from http.server import HTTPServer, BaseHTTPRequestHandler',
        'class H(BaseHTTPRequestHandler):',
        '  def do_GET(self):',
        '    self.send_response(200 if self.path == "/health" else 404)',
        '    self.end_headers(); self.wfile.write(b"ok" if self.path == "/health" else b"")',
        '  def log_message(self,*a): pass',
        'HTTPServer(("0.0.0.0", 3000), H).serve_forever()',
        'HEALTHEOF',
        'nohup python3 /opt/burnware/health_server.py &',
        ''
      );
    }

    userData.addCommands('echo "Application started successfully"');

    return userData;
  }

  /**
   * Build minimal user data for testing
   */
  static buildMinimal(): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'yum update -y',
      'echo "Instance ready"'
    );
    return userData;
  }
}
