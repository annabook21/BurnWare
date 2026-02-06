/**
 * Frontend Stack
 * Creates S3 bucket, CloudFront distribution, and deploys built SPA via CDK
 * File size: ~360 lines
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { DockerImage } from 'aws-cdk-lib';
import { TagUtils } from '../utils/tags';
import { NamingUtils } from '../utils/naming';
import { CLOUDFRONT_CONFIG } from '../config/constants';

export interface FrontendStackProps extends StackProps {
  environment: string;
  domainName: string;
  certificateArn?: string;
  webAclArn?: string;
}

export class FrontendStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly distributionDomain: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { environment, domainName, certificateArn, webAclArn } = props;

    // Create S3 bucket for SPA assets
    // https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/deploy-a-react-based-single-page-application-to-amazon-s3-and-cloudfront.html
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: NamingUtils.getResourceName('frontend', environment),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      enforceSSL: true,
    });

    // Create cache policies
    // https://aws.amazon.com/blogs/networking-and-content-delivery/host-single-page-applications-spa-with-tiered-ttls-on-cloudfront-and-s3/
    const indexCachePolicy = new cloudfront.CachePolicy(this, 'IndexCachePolicy', {
      cachePolicyName: NamingUtils.getResourceName('index-cache', environment),
      comment: 'Short TTL for index.html',
      defaultTtl: Duration.seconds(CLOUDFRONT_CONFIG.indexCacheTtl),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(600),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const assetCachePolicy = new cloudfront.CachePolicy(this, 'AssetCachePolicy', {
      cachePolicyName: NamingUtils.getResourceName('asset-cache', environment),
      comment: 'Long TTL for versioned assets',
      defaultTtl: Duration.seconds(CLOUDFRONT_CONFIG.assetCacheTtl),
      minTtl: Duration.seconds(CLOUDFRONT_CONFIG.assetCacheTtl),
      maxTtl: Duration.seconds(CLOUDFRONT_CONFIG.assetCacheTtl),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Get certificate if provided (must be in us-east-1 for CloudFront)
    const certificate = certificateArn
      ? certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', certificateArn)
      : undefined;

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `BurnWare SPA - ${environment}`,
      defaultRootObject: 'index.html',
      domainNames: certificate ? [domainName] : undefined,
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      sslSupportMethod: certificate
        ? cloudfront.SSLMethod.SNI
        : undefined,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: true,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: indexCachePolicy,
      },
      additionalBehaviors: {
        '/static/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          compress: true,
          cachePolicy: assetCachePolicy,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(300),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(300),
        },
      ],
      webAclId: webAclArn,
    });

    // Bucket policy for CloudFront is added automatically by S3BucketOrigin.withOriginAccessControl

    this.distributionDomain = this.distribution.distributionDomainName;

    // Deploy frontend build to S3 (builds via Docker or local fallback)
    const frontendPath = path.join(__dirname, '../../frontend');
    new s3deploy.BucketDeployment(this, 'FrontendDeploy', {
      sources: [
        s3deploy.Source.asset(frontendPath, {
          bundling: {
            image: DockerImage.fromRegistry('node:20-alpine'),
            command: [
              'sh',
              '-c',
              '(test -f package-lock.json && npm ci || npm install) && npm run build && cp -r dist/* /asset-output/',
            ],
            user: 'root',
              local: {
                tryBundle(outputDir: string): boolean {
                  try {
                    const hasLock = fs.existsSync(path.join(frontendPath, 'package-lock.json'));
                    execSync(hasLock ? 'npm ci' : 'npm install', { cwd: frontendPath, stdio: 'inherit' });
                  execSync('npm run build', { cwd: frontendPath, stdio: 'inherit' });
                  const distPath = path.join(frontendPath, 'dist');
                  if (fs.existsSync(distPath)) {
                    execSync(`cp -r "${distPath}"/* "${outputDir}/"`, { stdio: 'inherit' });
                    return true;
                  }
                } catch {
                  return false;
                }
                return false;
              },
            },
          },
        }),
      ],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // Apply tags
    TagUtils.applyStandardTags(this, { environment });
    TagUtils.applyTierTag(this, 'presentation');

    // CloudFormation Outputs
    new CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'Frontend S3 Bucket Name',
      exportName: `${environment}-frontend-bucket`,
    });

    new CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${environment}-cf-distribution-id`,
    });

    new CfnOutput(this, 'DistributionDomain', {
      value: this.distributionDomain,
      description: 'CloudFront Distribution Domain',
      exportName: `${environment}-cf-domain`,
    });

    new CfnOutput(this, 'FrontendUrl', {
      value: certificate ? `https://${domainName}` : `https://${this.distributionDomain}`,
      description: 'Frontend URL',
    });

    new CfnOutput(this, 'CachingStrategy', {
      value: 'index.html: 5min TTL, static assets: 1 year TTL',
      description: 'Caching Strategy',
    });
  }
}
