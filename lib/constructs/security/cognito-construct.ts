/**
 * Cognito Construct
 * Creates Cognito User Pool for authentication
 * File size: ~180 lines
 */

import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { NamingUtils } from '../../utils/naming';

export interface CognitoConstructProps {
  environment: string;
  domainPrefix?: string;
}

export class CognitoConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain?: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

    const { environment, domainPrefix } = props;

    // Create User Pool
    // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: NamingUtils.getResourceName('user-pool', environment),
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        preferredUsername: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
      // MFA configuration (optional, can be enforced)
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      // Threat protection (replaces deprecated advancedSecurityMode)
      // https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-sign-in-feature-plans.html
      featurePlan: cognito.FeaturePlan.PLUS,
      standardThreatProtectionMode: cognito.StandardThreatProtectionMode.FULL_FUNCTION,
      customThreatProtectionMode: cognito.CustomThreatProtectionMode.FULL_FUNCTION,
      // Email configuration
      email: cognito.UserPoolEmail.withCognito(),
    });

    // Create User Pool Client for SPA
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: NamingUtils.getResourceName('user-pool-client', environment),
      generateSecret: false, // SPA cannot securely store secret
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: false,
        adminUserPassword: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // Optional: Create User Pool Domain for hosted UI
    if (domainPrefix) {
      this.userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
        cognitoDomain: {
          domainPrefix,
        },
      });
    }
  }

  /**
   * Get User Pool ARN for IAM conditions
   */
  public getUserPoolArn(): string {
    return this.userPool.userPoolArn;
  }

  /**
   * Get User Pool ID
   */
  public getUserPoolId(): string {
    return this.userPool.userPoolId;
  }

  /**
   * Get User Pool Client ID
   */
  public getUserPoolClientId(): string {
    return this.userPoolClient.userPoolClientId;
  }
}
