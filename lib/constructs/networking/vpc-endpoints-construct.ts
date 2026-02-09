/**
 * VPC Endpoints Construct
 * Creates all VPC endpoints for NAT-free architecture
 * File size: ~195 lines
 */

import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NamingUtils } from '../../utils/naming';

export interface VpcEndpointsConstructProps {
  vpc: ec2.IVpc;
  endpointSecurityGroup: ec2.ISecurityGroup;
  environment: string;
}

export class VpcEndpointsConstruct extends Construct {
  public readonly s3GatewayEndpoint: ec2.IGatewayVpcEndpoint;
  public readonly ssmEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly ssmMessagesEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly ec2MessagesEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly logsEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly secretsManagerEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly monitoringEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly xrayEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly codeDeployEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly codeDeployCommandsEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly cognitoIdpEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly appSyncEndpoint: ec2.IInterfaceVpcEndpoint;

  constructor(scope: Construct, id: string, props: VpcEndpointsConstructProps) {
    super(scope, id);

    const { vpc, endpointSecurityGroup, environment } = props;

    // S3 Gateway Endpoint (no cost)
    // https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html
    this.s3GatewayEndpoint = vpc.addGatewayEndpoint('S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // SSM Interface Endpoints
    // https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-privatelink.html
    this.ssmEndpoint = this.createInterfaceEndpoint(
      'SSM',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.SSM,
      endpointSecurityGroup,
      environment
    );

    this.ssmMessagesEndpoint = this.createInterfaceEndpoint(
      'SSMMessages',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      endpointSecurityGroup,
      environment
    );

    this.ec2MessagesEndpoint = this.createInterfaceEndpoint(
      'EC2Messages',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
      endpointSecurityGroup,
      environment
    );

    // CloudWatch Logs Endpoint
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/cloudwatch-logs-and-interface-VPC.html
    this.logsEndpoint = this.createInterfaceEndpoint(
      'Logs',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      endpointSecurityGroup,
      environment
    );

    // Secrets Manager Endpoint
    // https://docs.aws.amazon.com/secretsmanager/latest/userguide/vpc-endpoint-overview.html
    this.secretsManagerEndpoint = this.createInterfaceEndpoint(
      'SecretsManager',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      endpointSecurityGroup,
      environment
    );

    // CloudWatch Monitoring Endpoint
    this.monitoringEndpoint = this.createInterfaceEndpoint(
      'Monitoring',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_MONITORING,
      endpointSecurityGroup,
      environment
    );

    // X-Ray Endpoint (optional, for distributed tracing)
    this.xrayEndpoint = this.createInterfaceEndpoint(
      'XRay',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.XRAY,
      endpointSecurityGroup,
      environment
    );

    // CodeDeploy Endpoints (required for agent in NAT-free VPC)
    // https://docs.aws.amazon.com/codedeploy/latest/userguide/vpc-endpoints.html
    this.codeDeployEndpoint = this.createInterfaceEndpoint(
      'CodeDeploy',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.CODEDEPLOY,
      endpointSecurityGroup,
      environment
    );

    this.codeDeployCommandsEndpoint = this.createInterfaceEndpoint(
      'CodeDeployCommands',
      vpc,
      ec2.InterfaceVpcEndpointAwsService.CODEDEPLOY_COMMANDS_SECURE,
      endpointSecurityGroup,
      environment
    );

    // Cognito IDP Endpoint (required for aws-jwt-verify JWKS fetch in NAT-free VPC)
    // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
    // Note: cognito-idp only supports us-east-1b/c/d — exclude us-east-1a subnets
    this.cognitoIdpEndpoint = new ec2.InterfaceVpcEndpoint(this, 'CognitoIdpEndpoint', {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.COGNITO_IDP,
      privateDnsEnabled: true,
      securityGroups: [endpointSecurityGroup],
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: ['us-east-1b', 'us-east-1c'],
      },
    });

    // AppSync Events Endpoint (required for publishing events from NAT-free VPC)
    this.appSyncEndpoint = this.createInterfaceEndpoint(
      'AppSync',
      vpc,
      new ec2.InterfaceVpcEndpointService('com.amazonaws.us-east-1.appsync-api'),
      endpointSecurityGroup,
      environment
    );
  }

  /**
   * Helper method to create interface VPC endpoints with consistent configuration
   */
  private createInterfaceEndpoint(
    name: string,
    vpc: ec2.IVpc,
    service: ec2.IInterfaceVpcEndpointService,
    securityGroup: ec2.ISecurityGroup,
    environment: string
  ): ec2.IInterfaceVpcEndpoint {
    return new ec2.InterfaceVpcEndpoint(this, `${name}Endpoint`, {
      vpc,
      service,
      privateDnsEnabled: true,
      securityGroups: [securityGroup],
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
  }

  /**
   * Get all interface endpoint IDs for export
   */
  public getEndpointIds(): Record<string, string> {
    return {
      ssm: this.ssmEndpoint.vpcEndpointId,
      ssmMessages: this.ssmMessagesEndpoint.vpcEndpointId,
      ec2Messages: this.ec2MessagesEndpoint.vpcEndpointId,
      logs: this.logsEndpoint.vpcEndpointId,
      secretsManager: this.secretsManagerEndpoint.vpcEndpointId,
      monitoring: this.monitoringEndpoint.vpcEndpointId,
      xray: this.xrayEndpoint.vpcEndpointId,
      codeDeploy: this.codeDeployEndpoint.vpcEndpointId,
      codeDeployCommands: this.codeDeployCommandsEndpoint.vpcEndpointId,
      cognitoIdp: this.cognitoIdpEndpoint.vpcEndpointId,
      appSync: this.appSyncEndpoint.vpcEndpointId,
    };
  }
}
