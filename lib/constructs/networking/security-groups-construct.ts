/**
 * Security Groups Construct
 * Creates all security groups for the application tiers
 * File size: ~245 lines
 */

import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NamingUtils } from '../../utils/naming';

export interface SecurityGroupsConstructProps {
  vpc: ec2.IVpc;
  environment: string;
}

export class SecurityGroupsConstruct extends Construct {
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;
  public readonly rdsSecurityGroup: ec2.SecurityGroup;
  public readonly endpointSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupsConstructProps) {
    super(scope, id);

    const { vpc, environment } = props;

    // ALB Security Group
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      securityGroupName: NamingUtils.getSecurityGroupName('alb', environment),
      allowAllOutbound: false,
    });

    // Inbound: listener ports (HTTPS and HTTP for dev redirect)
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet'
    );
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet (dev or redirect to HTTPS)'
    );

    // EC2 Security Group
    this.ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc,
      description: 'Security group for EC2 instances',
      securityGroupName: NamingUtils.getSecurityGroupName('ec2', environment),
      allowAllOutbound: false,
    });

    // RDS Security Group
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL',
      securityGroupName: NamingUtils.getSecurityGroupName('rds', environment),
      allowAllOutbound: false,
    });

    // VPC Endpoint Security Group
    this.endpointSecurityGroup = new ec2.SecurityGroup(this, 'EndpointSecurityGroup', {
      vpc,
      description: 'Security group for VPC endpoints',
      securityGroupName: NamingUtils.getSecurityGroupName('vpce', environment),
      allowAllOutbound: false,
    });

    // Configure security group rules after all groups are created
    this.configureSecurityGroupRules();
  }

  /**
   * Configure all security group rules
   * Called after all security groups are created to avoid circular dependencies
   */
  private configureSecurityGroupRules(): void {
    // ALB → EC2: Allow traffic on application port (3000)
    this.albSecurityGroup.addEgressRule(
      this.ec2SecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic to EC2 instances'
    );

    // EC2 ← ALB: Allow traffic from ALB
    this.ec2SecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow traffic from ALB'
    );

    // EC2 → RDS: Allow PostgreSQL traffic
    this.ec2SecurityGroup.addEgressRule(
      this.rdsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL to RDS'
    );

    // EC2 → VPC Endpoints: Allow HTTPS traffic
    this.ec2SecurityGroup.addEgressRule(
      this.endpointSecurityGroup,
      ec2.Port.tcp(443),
      'Allow HTTPS to VPC endpoints'
    );

    // RDS ← EC2: Allow PostgreSQL from EC2 only
    this.rdsSecurityGroup.addIngressRule(
      this.ec2SecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from EC2'
    );

    // VPC Endpoints ← EC2: Allow HTTPS from EC2
    this.endpointSecurityGroup.addIngressRule(
      this.ec2SecurityGroup,
      ec2.Port.tcp(443),
      'Allow HTTPS from EC2'
    );
  }

  /**
   * Get all security groups for export
   */
  public getAllSecurityGroups(): {
    alb: ec2.ISecurityGroup;
    ec2: ec2.ISecurityGroup;
    rds: ec2.ISecurityGroup;
    endpoint: ec2.ISecurityGroup;
  } {
    return {
      alb: this.albSecurityGroup,
      ec2: this.ec2SecurityGroup,
      rds: this.rdsSecurityGroup,
      endpoint: this.endpointSecurityGroup,
    };
  }
}
