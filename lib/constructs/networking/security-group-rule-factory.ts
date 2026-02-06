/**
 * Security Group Rule Factory
 * Helper functions for creating common security group rules
 * File size: ~120 lines
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class SecurityGroupRuleFactory {
  /**
   * Create HTTPS ingress rule from a source security group
   */
  static createHttpsIngressRule(sourceSecurityGroup: ec2.ISecurityGroup): ec2.CfnSecurityGroup.IngressProperty {
    return {
      ipProtocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      sourceSecurityGroupId: sourceSecurityGroup.securityGroupId,
      description: 'Allow HTTPS from source security group',
    };
  }

  /**
   * Create PostgreSQL ingress rule from a source security group
   */
  static createPostgresIngressRule(sourceSecurityGroup: ec2.ISecurityGroup): ec2.CfnSecurityGroup.IngressProperty {
    return {
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: sourceSecurityGroup.securityGroupId,
      description: 'Allow PostgreSQL from source security group',
    };
  }

  /**
   * Create custom port ingress rule from a source security group
   */
  static createCustomPortIngressRule(
    port: number,
    sourceSecurityGroup: ec2.ISecurityGroup,
    description: string
  ): ec2.CfnSecurityGroup.IngressProperty {
    return {
      ipProtocol: 'tcp',
      fromPort: port,
      toPort: port,
      sourceSecurityGroupId: sourceSecurityGroup.securityGroupId,
      description,
    };
  }

  /**
   * Create HTTPS egress rule to a destination security group
   */
  static createHttpsEgressRule(destinationSecurityGroup: ec2.ISecurityGroup): ec2.CfnSecurityGroup.EgressProperty {
    return {
      ipProtocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      destinationSecurityGroupId: destinationSecurityGroup.securityGroupId,
      description: 'Allow HTTPS to destination security group',
    };
  }

  /**
   * Create public HTTPS ingress rule (for ALB)
   */
  static createPublicHttpsIngressRule(): ec2.CfnSecurityGroup.IngressProperty {
    return {
      ipProtocol: 'tcp',
      fromPort: 443,
      toPort: 443,
      cidrIp: '0.0.0.0/0',
      description: 'Allow HTTPS from internet',
    };
  }

  /**
   * Create custom port egress rule to destination security group
   */
  static createCustomPortEgressRule(
    port: number,
    destinationSecurityGroup: ec2.ISecurityGroup,
    description: string
  ): ec2.CfnSecurityGroup.EgressProperty {
    return {
      ipProtocol: 'tcp',
      fromPort: port,
      toPort: port,
      destinationSecurityGroupId: destinationSecurityGroup.securityGroupId,
      description,
    };
  }

  /**
   * Create allow all egress rule (for VPC endpoints)
   */
  static createAllowAllEgressRule(): ec2.CfnSecurityGroup.EgressProperty {
    return {
      ipProtocol: '-1',
      cidrIp: '0.0.0.0/0',
      description: 'Allow all outbound traffic',
    };
  }
}
