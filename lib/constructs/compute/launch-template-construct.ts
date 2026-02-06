/**
 * Launch Template Construct
 * Creates EC2 launch template with security best practices
 * File size: ~175 lines
 */

import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { UserDataBuilder, UserDataConfig } from './user-data-builder';
import { NamingUtils } from '../../utils/naming';

export interface LaunchTemplateConstructProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  instanceRole: iam.IRole;
  environment: string;
  amiId?: string;
  instanceType?: string;
  userDataConfig?: UserDataConfig;
}

export class LaunchTemplateConstruct extends Construct {
  public readonly launchTemplate: ec2.LaunchTemplate;

  constructor(scope: Construct, id: string, props: LaunchTemplateConstructProps) {
    super(scope, id);

    const {
      vpc,
      securityGroup,
      instanceRole,
      environment,
      amiId,
      instanceType = 't3.micro',
      userDataConfig,
    } = props;

    // Get latest Amazon Linux 2023 AMI if not provided
    const ami = amiId
      ? ec2.MachineImage.genericLinux({ [vpc.stack.region]: amiId })
      : ec2.MachineImage.latestAmazonLinux2023({
          cpuType: ec2.AmazonLinuxCpuType.X86_64,
        });

    // Build user data script
    const userData = userDataConfig
      ? UserDataBuilder.build(userDataConfig)
      : UserDataBuilder.buildMinimal();

    // Create launch template
    this.launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      launchTemplateName: NamingUtils.getResourceName('lt', environment),
      machineImage: ami,
      instanceType: new ec2.InstanceType(instanceType),
      securityGroup,
      role: instanceRole,
      userData,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
            deleteOnTermination: true,
          }),
        },
      ],
      // IMDSv2 required for enhanced security
      requireImdsv2: true,
      httpTokens: ec2.LaunchTemplateHttpTokens.REQUIRED,
      httpPutResponseHopLimit: 1,
      // Monitoring
      detailedMonitoring: true,
      // No public IP (private subnet)
      associatePublicIpAddress: false,
    });
  }

  /**
   * Get launch template ID
   */
  public getLaunchTemplateId(): string {
    return this.launchTemplate.launchTemplateId!;
  }

  /**
   * Get launch template name
   */
  public getLaunchTemplateName(): string {
    return this.launchTemplate.launchTemplateName!;
  }
}
