/**
 * Network Stack
 * Creates VPC, subnets, VPC endpoints, and security groups
 * File size: ~280 lines
 */

import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { VpcEndpointsConstruct } from '../constructs/networking/vpc-endpoints-construct';
import { SecurityGroupsConstruct } from '../constructs/networking/security-groups-construct';
import { VPC_CONFIG, RESOURCE_NAMES } from '../config/constants';
import { TagUtils } from '../utils/tags';

export interface NetworkStackProps extends StackProps {
  environment: string;
}

export class NetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly privateSubnets: ec2.ISubnet[];
  public readonly isolatedSubnets: ec2.ISubnet[];
  public readonly albSecurityGroup: ec2.ISecurityGroup;
  public readonly ec2SecurityGroup: ec2.ISecurityGroup;
  public readonly rdsSecurityGroup: ec2.ISecurityGroup;
  public readonly endpointSecurityGroup: ec2.ISecurityGroup;
  public readonly s3GatewayEndpoint: ec2.IGatewayVpcEndpoint;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Create VPC with public, private, and isolated subnets
    // NAT-free architecture as per requirements
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${RESOURCE_NAMES.vpc}-${environment}`,
      maxAzs: VPC_CONFIG.maxAzs,
      natGateways: VPC_CONFIG.natGateways, // 0 - NAT-free
      ipAddresses: ec2.IpAddresses.cidr(VPC_CONFIG.cidr),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Get subnet references
    this.publicSubnets = this.vpc.publicSubnets;
    this.privateSubnets = this.vpc.privateSubnets;
    this.isolatedSubnets = this.vpc.isolatedSubnets;

    // Create security groups
    const securityGroups = new SecurityGroupsConstruct(this, 'SecurityGroups', {
      vpc: this.vpc,
      environment,
    });

    this.albSecurityGroup = securityGroups.albSecurityGroup;
    this.ec2SecurityGroup = securityGroups.ec2SecurityGroup;
    this.rdsSecurityGroup = securityGroups.rdsSecurityGroup;
    this.endpointSecurityGroup = securityGroups.endpointSecurityGroup;

    // VPC Flow Logs for security and troubleshooting (Well-Architected)
    // https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html
    const flowLogGroup = new logs.LogGroup(this, 'FlowLogGroup', {
      logGroupName: `/aws/vpc/${RESOURCE_NAMES.vpc}-${environment}/flowlogs`,
      retention: 30,
    });
    this.vpc.addFlowLog('FlowLog', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.REJECT,
    });

    // Create VPC endpoints
    const vpcEndpoints = new VpcEndpointsConstruct(this, 'VpcEndpoints', {
      vpc: this.vpc,
      endpointSecurityGroup: this.endpointSecurityGroup,
      environment,
    });

    this.s3GatewayEndpoint = vpcEndpoints.s3GatewayEndpoint;

    // Apply tags
    TagUtils.applyStandardTags(this, { environment });
    TagUtils.applyTierTag(this, 'application');

    // CloudFormation Outputs
    new CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${environment}-vpc-id`,
    });

    new CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
    });

    new CfnOutput(this, 'PublicSubnetIds', {
      value: this.publicSubnets.map((s) => s.subnetId).join(','),
      description: 'Public Subnet IDs',
      exportName: `${environment}-public-subnet-ids`,
    });

    new CfnOutput(this, 'PrivateSubnetIds', {
      value: this.privateSubnets.map((s) => s.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: `${environment}-private-subnet-ids`,
    });

    new CfnOutput(this, 'IsolatedSubnetIds', {
      value: this.isolatedSubnets.map((s) => s.subnetId).join(','),
      description: 'Isolated Subnet IDs',
      exportName: `${environment}-isolated-subnet-ids`,
    });

    new CfnOutput(this, 'AlbSecurityGroupId', {
      value: this.albSecurityGroup.securityGroupId,
      description: 'ALB Security Group ID',
      exportName: `${environment}-alb-sg-id`,
    });

    new CfnOutput(this, 'Ec2SecurityGroupId', {
      value: this.ec2SecurityGroup.securityGroupId,
      description: 'EC2 Security Group ID',
      exportName: `${environment}-ec2-sg-id`,
    });

    new CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.rdsSecurityGroup.securityGroupId,
      description: 'RDS Security Group ID',
      exportName: `${environment}-rds-sg-id`,
    });

    // Output VPC endpoint information
    const endpointIds = vpcEndpoints.getEndpointIds();
    Object.entries(endpointIds).forEach(([name, id]) => {
      new CfnOutput(this, `${name}EndpointId`, {
        value: id,
        description: `${name} VPC Endpoint ID`,
      });
    });
  }
}
