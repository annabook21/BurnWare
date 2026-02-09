/**
 * User Data Builder
 * Generates user data scripts for EC2 instances in a NAT-free VPC.
 * All package installs use AL2023 repos (hosted on S3, accessible via gateway endpoint).
 * CodeDeploy agent is installed from the S3 resource kit with enable_auth_policy for VPC endpoint mode.
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
  /** Cognito User Pool ID (for JWT verification). */
  cognitoUserPoolId: string;
  /** Cognito App Client ID (for JWT verification). */
  cognitoClientId: string;
  /** AppSync Events HTTP domain (for real-time notifications). */
  appSyncHttpDns?: string;
  /** AppSync Events API key (for publishing events). */
  appSyncApiKey?: string;
  /** Lambda ARN for publishing AppSync Events from NAT-free VPC. */
  appSyncPublishFnArn?: string;
}

export class UserDataBuilder {
  /**
   * Build user data script for EC2 instances in a NAT-free VPC.
   *
   * 1. Install Node.js 20 from AL2023 repos (served from S3 via gateway endpoint)
   * 2. Install CodeDeploy agent from S3 resource kit with enable_auth_policy
   * 3. Download and extract application artifact from S3
   * 4. Start application with bundled PM2
   *
   * https://docs.aws.amazon.com/codedeploy/latest/userguide/vpc-endpoints.html
   * https://docs.aws.amazon.com/codedeploy/latest/userguide/codedeploy-agent-operations-install-linux.html
   */
  static build(config: UserDataConfig): ec2.UserData {
    const userData = ec2.UserData.forLinux();

    // --- Phase 1: System packages (AL2023 repos on S3 via gateway endpoint) ---
    userData.addCommands(
      'set -euo pipefail',
      'exec > >(tee /var/log/user-data.log) 2>&1',
      '',
      '# Force IPv4 for dnf: AL2023 repos use s3.dualstack URLs which resolve to',
      '# IPv6 first, but the S3 gateway endpoint only routes IPv4 traffic.',
      'echo "ip_resolve=4" >> /etc/dnf/dnf.conf',
      '',
      '# Install Node.js 20 from AL2023 repos (hosted on S3, no internet needed)',
      'dnf install -y nodejs20 nodejs20-npm jq ruby',
      '',
    );

    // --- Phase 2: CodeDeploy agent from S3 resource kit ---
    // https://docs.aws.amazon.com/codedeploy/latest/userguide/codedeploy-agent-operations-install-linux.html
    userData.addCommands(
      '# Install CodeDeploy agent from S3 resource kit (no internet needed)',
      `CODEDEPLOY_BIN="/opt/codedeploy-agent/bin/install"`,
      `if [ ! -f "$CODEDEPLOY_BIN" ]; then`,
      `  aws s3 cp s3://aws-codedeploy-${config.region}/latest/install /tmp/codedeploy-install --region ${config.region}`,
      '  chmod +x /tmp/codedeploy-install',
      '  /tmp/codedeploy-install auto',
      'fi',
      '',
      '# Configure agent for VPC endpoint mode (SigV4 auth)',
      '# https://docs.aws.amazon.com/codedeploy/latest/userguide/vpc-endpoints.html',
      'mkdir -p /etc/codedeploy-agent/conf',
      'cat > /etc/codedeploy-agent/conf/codedeployagent.yml << \'AGENTEOF\'',
      '---',
      ':log_aws_wire: false',
      ':log_dir: /var/log/aws/codedeploy-agent/',
      ':pid_dir: /opt/codedeploy-agent/state/.pid/',
      ':program_name: codedeploy-agent',
      ':root_dir: /opt/codedeploy-agent/deployment-root',
      ':on_premises_config_file: /etc/codedeploy-agent/conf/codedeploy.onpremises.yml',
      ':verbose: false',
      ':wait_between_runs: 1',
      ':max_revisions: 5',
      ':enable_auth_policy: true',
      'AGENTEOF',
      '',
      'systemctl restart codedeploy-agent',
      'systemctl enable codedeploy-agent',
      '',
    );

    // --- Phase 3: Environment configuration ---
    userData.addCommands(
      '# Write environment file for the application',
      'mkdir -p /opt/burnware',
      'cat > /opt/burnware/.env << ENVEOF',
      `AWS_REGION=${config.region}`,
      `ENVIRONMENT=${config.environment}`,
      `LOG_GROUP=${config.logGroup}`,
      `DB_SECRET_ID=${config.dbSecretId}`,
      `DB_HOST=${config.dbEndpoint}`,
      `DB_PORT=${config.dbPort}`,
      'DB_NAME=burnware',
      'NODE_ENV=production',
      'PORT=3000',
      'ALLOWED_ORIGINS=*',
      `COGNITO_USER_POOL_ID=${config.cognitoUserPoolId}`,
      `COGNITO_CLIENT_ID=${config.cognitoClientId}`,
      ...(config.appSyncHttpDns ? [`APPSYNC_HTTP_DOMAIN=${config.appSyncHttpDns}`] : []),
      ...(config.appSyncApiKey ? [`APPSYNC_API_KEY=${config.appSyncApiKey}`] : []),
      ...(config.appSyncPublishFnArn ? [`APPSYNC_PUBLISH_FN_ARN=${config.appSyncPublishFnArn}`] : []),
      'ENVEOF',
      '',
    );

    if (config.deploymentBucket) {
      // --- Phase 4: Download and start application ---
      userData.addCommands(
        '# Download application artifact from S3 (via gateway endpoint)',
        `aws s3 cp s3://${config.deploymentBucket}/releases/app-${config.appVersion}.tar.gz /tmp/app.tar.gz --region ${config.region}`,
        '',
        '# Extract artifact (contains dist/, node_modules/, package.json, ecosystem.config.js, appspec.yml, scripts/)',
        'tar -xzf /tmp/app.tar.gz -C /opt/burnware',
        'rm -f /tmp/app.tar.gz',
        'chown -R ec2-user:ec2-user /opt/burnware',
        '',
        '# Start CloudWatch agent and X-Ray daemon',
        '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:AmazonCloudWatch-linux || true',
        'systemctl start xray 2>/dev/null || true',
        'systemctl enable xray 2>/dev/null || true',
        '',
        '# Start application with bundled PM2 (use direct path, not .bin/ symlink)',
        'su - ec2-user -c "cd /opt/burnware && node node_modules/pm2/bin/pm2 start ecosystem.config.js"',
        'su - ec2-user -c "cd /opt/burnware && node node_modules/pm2/bin/pm2 save"',
        '',
      );
    } else {
      // No deployment bucket: run minimal health endpoint for ALB (dev/testing)
      userData.addCommands(
        '# No deployment bucket: run minimal health endpoint for ALB (dev)',
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
        '',
      );
    }

    userData.addCommands('echo "User data completed successfully"');

    return userData;
  }

  /**
   * Build minimal user data for testing
   */
  static buildMinimal(): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'echo "Instance ready"'
    );
    return userData;
  }
}
