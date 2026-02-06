/**
 * WAF Stack
 * Creates WAF WebACL with rate limiting and managed rules
 * File size: ~180 lines
 */

import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { WafRulesConstruct } from '../constructs/security/waf-rules-construct';
import { TagUtils } from '../utils/tags';
import { NamingUtils } from '../utils/naming';
import { WAF_CONFIG } from '../config/constants';

export interface WafStackProps extends StackProps {
  environment: string;
  scope: 'CLOUDFRONT' | 'REGIONAL';
}

export class WafStack extends Stack {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    const { environment, scope: wafScope } = props;

    // Create WAF rules
    const wafRules = new WafRulesConstruct(this, 'WafRules', {
      scope: wafScope,
    });

    // Create WebACL
    // https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-request-limiting.html
    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: NamingUtils.getResourceName('webacl', environment),
      scope: wafScope,
      defaultAction: { allow: {} },
      rules: wafRules.rules,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: NamingUtils.getResourceName('webacl-metric', environment),
      },
      // Token configuration
      // https://docs.aws.amazon.com/waf/latest/developerguide/waf-tokens-immunity-times.html
      captchaConfig: {
        immunityTimeProperty: {
          immunityTime: WAF_CONFIG.captchaImmunityTime,
        },
      },
      challengeConfig: {
        immunityTimeProperty: {
          immunityTime: WAF_CONFIG.captchaImmunityTime,
        },
      },
    });

    this.webAclArn = this.webAcl.attrArn;

    // Apply tags
    TagUtils.applyStandardTags(this, { environment });

    // CloudFormation Outputs
    new CfnOutput(this, 'WebAclId', {
      value: this.webAcl.attrId,
      description: 'WAF WebACL ID',
      exportName: `${environment}-webacl-id`,
    });

    new CfnOutput(this, 'WebAclArn', {
      value: this.webAclArn,
      description: 'WAF WebACL ARN',
      exportName: `${environment}-webacl-arn`,
    });

    new CfnOutput(this, 'WafRateLimitInfo', {
      value: `Rate limit: ${WAF_CONFIG.rateLimitThreshold} requests per 5 minutes. CAPTCHA immunity: ${WAF_CONFIG.captchaImmunityTime}s`,
      description: 'WAF Rate Limiting Configuration',
    });

    new CfnOutput(this, 'WafDocumentation', {
      value: 'https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-request-limiting.html',
      description: 'WAF Rate Limiting Documentation',
    });
  }
}
