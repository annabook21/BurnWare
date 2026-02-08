/**
 * DNS Stack
 * Creates Route 53 hosted zone for burnware.live.
 * Shared across environments (no env suffix in stack name).
 * Certificate creation is handled in each environment's Frontend stack
 * to enforce deployment ordering (NS delegation must happen first).
 */

import { Stack, StackProps, CfnOutput, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { TagUtils } from '../utils/tags';

export interface DnsStackProps extends StackProps {
  domainName: string;
}

export class DnsStack extends Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    this.hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: domainName,
    });

    TagUtils.applyStandardTags(this, { environment: 'shared' });

    // Nameservers to configure at the domain registrar
    // https://github.com/aws/aws-cdk/issues/11108
    new CfnOutput(this, 'NameServers', {
      value: Fn.join(', ', this.hostedZone.hostedZoneNameServers!),
      description: 'Update your domain registrar with these nameservers',
    });

    new CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
    });
  }
}
