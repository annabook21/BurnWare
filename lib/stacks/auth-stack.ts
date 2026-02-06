/**
 * Auth Stack
 * Creates Cognito User Pool for authentication
 * File size: ~140 lines
 */

import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoConstruct } from '../constructs/security/cognito-construct';
import { TagUtils } from '../utils/tags';

export interface AuthStackProps extends StackProps {
  environment: string;
  domainPrefix?: string;
}

export class AuthStack extends Stack {
  public readonly userPool: string;
  public readonly userPoolClient: string;
  public readonly userPoolArn: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { environment, domainPrefix } = props;

    // Create Cognito User Pool
    const cognito = new CognitoConstruct(this, 'Cognito', {
      environment,
      domainPrefix,
    });

    this.userPool = cognito.getUserPoolId();
    this.userPoolClient = cognito.getUserPoolClientId();
    this.userPoolArn = cognito.getUserPoolArn();

    // Apply tags
    TagUtils.applyStandardTags(this, { environment });

    // CloudFormation Outputs
    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool,
      description: 'Cognito User Pool ID',
      exportName: `${environment}-user-pool-id`,
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient,
      description: 'Cognito User Pool Client ID',
      exportName: `${environment}-user-pool-client-id`,
    });

    new CfnOutput(this, 'UserPoolArn', {
      value: this.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${environment}-user-pool-arn`,
    });

    // Output instructions for JWT validation
    new CfnOutput(this, 'JwtValidationInstructions', {
      value: 'Use aws-jwt-verify library to validate tokens: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html',
      description: 'JWT Validation Documentation',
    });

    // Output issuer URL for JWT validation
    const region = Stack.of(this).region;
    new CfnOutput(this, 'JwtIssuer', {
      value: `https://cognito-idp.${region}.amazonaws.com/${this.userPool}`,
      description: 'JWT Issuer URL',
    });
  }
}
