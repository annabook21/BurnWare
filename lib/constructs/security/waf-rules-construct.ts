/**
 * WAF Rules Construct
 * Creates WAF rules with rate limiting and CAPTCHA
 * File size: ~175 lines
 */

import { Construct } from 'constructs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { WAF_CONFIG } from '../../config/constants';

export interface WafRulesConstructProps {
  scope: 'CLOUDFRONT' | 'REGIONAL';
}

export class WafRulesConstruct extends Construct {
  public readonly rules: wafv2.CfnWebACL.RuleProperty[];

  constructor(scope: Construct, id: string, props: WafRulesConstructProps) {
    super(scope, id);

    this.rules = this.createRules();
  }

  /**
   * Create all WAF rules
   */
  private createRules(): wafv2.CfnWebACL.RuleProperty[] {
    return [
      this.createAnonymousSendRateLimitRule(),
      this.createAWSManagedCommonRuleSet(),
      this.createAWSManagedKnownBadInputsRuleSet(),
    ];
  }

  /**
   * Create rate-based rule with CAPTCHA for anonymous send endpoint
   * https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-request-limiting.html
   */
  private createAnonymousSendRateLimitRule(): wafv2.CfnWebACL.RuleProperty {
    return {
      name: 'AnonymousSendRateLimit',
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: WAF_CONFIG.rateLimitThreshold,
          aggregateKeyType: 'IP',
          scopeDownStatement: {
            byteMatchStatement: {
              searchString: '/api/v1/send',
              fieldToMatch: { uriPath: {} },
              textTransformations: [{ priority: 0, type: 'NONE' }],
              positionalConstraint: 'STARTS_WITH',
            },
          },
        },
      },
      action: {
        captcha: {
          customRequestHandling: {
            insertHeaders: [
              {
                name: 'x-rate-limited',
                value: 'true',
              },
            ],
          },
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AnonymousSendRateLimit',
      },
    };
  }

  /**
   * Create AWS Managed Rules - Common Rule Set
   */
  private createAWSManagedCommonRuleSet(): wafv2.CfnWebACL.RuleProperty {
    return {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 2,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesCommonRuleSetMetric',
      },
    };
  }

  /**
   * Create AWS Managed Rules - Known Bad Inputs
   */
  private createAWSManagedKnownBadInputsRuleSet(): wafv2.CfnWebACL.RuleProperty {
    return {
      name: 'AWSManagedRulesKnownBadInputsRuleSet',
      priority: 3,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesKnownBadInputsRuleSetMetric',
      },
    };
  }
}
