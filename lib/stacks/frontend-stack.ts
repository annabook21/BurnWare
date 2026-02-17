/**
 * Frontend Stack
 * Creates S3 bucket, CloudFront distribution, and deploys built SPA via CDK
 * File size: ~360 lines
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { AssetHashType } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { DockerImage } from 'aws-cdk-lib';
import { TagUtils } from '../utils/tags';
import { NamingUtils } from '../utils/naming';
import { CLOUDFRONT_CONFIG } from '../config/constants';

/**
 * CloudFront Function: SPA URI rewrite
 * Rewrites non-file paths to /index.html so S3 never returns 404 for SPA routes.
 * This replaces distribution-level custom error responses, which would also
 * intercept 404/403 from the /api/* ALB origin and mask API errors with HTML.
 */
const SPA_REWRITE_FUNCTION_CODE = `
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.includes('.')) {
    return request;
  }
  request.uri = '/index.html';
  return request;
}
`;

export interface FrontendStackProps extends StackProps {
  environment: string;
  domainName: string;
  certificateArn?: string;
  webAclArn?: string;
  /** Cognito User Pool ID (from Auth stack) */
  cognitoUserPoolId: string;
  /** Cognito App Client ID (from Auth stack) */
  cognitoClientId: string;
  /** API base URL e.g. http://alb-dns-name (from App stack ALB) */
  apiBaseUrl: string;
  /** ALB for CloudFront VPC Origin /api/* proxy */
  alb?: elbv2.IApplicationLoadBalancer;
  /** Route 53 hosted zone for DNS validation and alias records */
  hostedZone?: route53.IHostedZone;
  /** AppSync Events HTTP domain (for real-time publish) */
  appSyncHttpDns?: string;
  /** AppSync Events WebSocket domain (for real-time subscribe) */
  appSyncRealtimeDns?: string;
  /** AppSync Events API key (browser auth for subscriptions) */
  appSyncApiKey?: string;
}

export class FrontendStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly distributionDomain: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { environment, domainName, certificateArn, webAclArn, alb, hostedZone, appSyncHttpDns, appSyncRealtimeDns, appSyncApiKey } = props;

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
      comment: 'Short TTL for index.html; origin Cache-Control preferred',
      defaultTtl: Duration.seconds(CLOUDFRONT_CONFIG.indexCacheTtl),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.days(30), // allow origin stale-while-revalidate
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

    // Get or create certificate (must be in us-east-1 for CloudFront)
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html
    const certificate = hostedZone
      ? new certificatemanager.Certificate(this, 'Certificate', {
          domainName,
          validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
        })
      : certificateArn
        ? certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', certificateArn)
        : undefined;

    // CloudFront Function for SPA routing on the default (S3) behavior only.
    // Rewrites non-file URIs to /index.html at the viewer-request level so S3
    // always finds the object. This avoids distribution-level custom error
    // responses, which would also intercept 404/403 from the /api/* ALB origin
    // and mask API errors with the SPA shell.
    const spaRewriteFn = new cloudfront.Function(this, 'SpaRewriteFunction', {
      functionName: NamingUtils.getResourceName('spa-rewrite', environment),
      code: cloudfront.FunctionCode.fromInline(SPA_REWRITE_FUNCTION_CODE),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'Rewrite SPA routes to /index.html',
    });

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
        functionAssociations: [{
          function: spaRewriteFn,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        // Vite emits hashed JS/CSS under /assets/; long TTL for immutable assets
        '/assets/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          compress: true,
          cachePolicy: assetCachePolicy,
        },
        ...(alb ? {
          '/api/*': {
            origin: origins.VpcOrigin.withApplicationLoadBalancer(alb, {
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            }),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          },
        } : {}),
      },
      webAclId: webAclArn,
    });

    // Bucket policy for CloudFront is added automatically by S3BucketOrigin.withOriginAccessControl

    // Create DNS alias records pointing domain to CloudFront
    // A record (IPv4) + AAAA record (IPv6) — alias at zone apex is required since
    // CNAME cannot exist at zone apex per DNS RFCs.
    if (hostedZone && certificate) {
      new route53.ARecord(this, 'AliasA', {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      });
      new route53.AaaaRecord(this, 'AliasAAAA', {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      });
    }

    this.distributionDomain = this.distribution.distributionDomainName;

    // Deploy frontend build to S3 (builds via Docker or local fallback)
    const frontendPath = path.join(__dirname, '../../frontend');
    // Runtime config: deploy-time values resolved by CloudFormation.
    // CDK tokens can't be used as build-time env vars (they're unresolved strings
    // like "${Token[...]}" at synth time). Instead, deploy a runtime-config.json
    // that the SPA fetches at page load. Local dev falls back to .env values.
    const runtimeConfig = s3deploy.Source.jsonData('runtime-config.json', {
      appSync: {
        httpDns: appSyncHttpDns ?? '',
        realtimeDns: appSyncRealtimeDns ?? '',
        apiKey: appSyncApiKey ?? '',
      },
    });

    // Set Cache-Control on objects so CloudFront/browsers revalidate without invalidation.
    // Single deployment applies same header to all files; /assets/* still gets long TTL via behavior.
    // For full tiered TTLs (1y immutable on JS/CSS), use two BucketDeployments from pre-built dist
    // with exclude so index.html gets short TTL and assets get long TTL (see AWS blog above).
    const deployCacheControl = [
      s3deploy.CacheControl.setPublic(),
      s3deploy.CacheControl.maxAge(Duration.seconds(CLOUDFRONT_CONFIG.indexCacheTtl)),
      s3deploy.CacheControl.staleWhileRevalidate(Duration.days(30)),
    ];

    new s3deploy.BucketDeployment(this, 'FrontendDeploy', {
      sources: [
        s3deploy.Source.asset(frontendPath, {
          // Hash the bundling output so deployment always updates when built files change
          assetHashType: AssetHashType.OUTPUT,
          bundling: {
            image: DockerImage.fromRegistry('node:20-alpine'),
            command: [
              'sh',
              '-c',
              [
                'rm -rf dist node_modules/.vite',
                '(test -f package-lock.json && npm ci || npm install)',
                'npm run build',
                'cp -r dist/* /asset-output/',
                'echo "build $(date +%Y-%m-%dT%H:%M:%S)Z" > /asset-output/build-id.txt',
              ].join(' && '),
            ],
            user: 'root',
            local: {
              tryBundle(outputDir: string): boolean {
                try {
                  const distDir = path.join(frontendPath, 'dist');
                  const viteCache = path.join(frontendPath, 'node_modules', '.vite');
                  if (fs.existsSync(distDir)) execSync(`rm -rf "${distDir}"`, { stdio: 'inherit' });
                  if (fs.existsSync(viteCache)) execSync(`rm -rf "${viteCache}"`, { stdio: 'inherit' });
                  const hasLock = fs.existsSync(path.join(frontendPath, 'package-lock.json'));
                  execSync(hasLock ? 'npm ci' : 'npm install', { cwd: frontendPath, stdio: 'inherit' });
                  execSync('npm run build', { cwd: frontendPath, stdio: 'inherit' });
                  if (fs.existsSync(distDir)) {
                    execSync(`cp -r "${distDir}"/* "${outputDir}/"`, { stdio: 'inherit' });
                    const buildId = `build ${new Date().toISOString()}`;
                    fs.writeFileSync(path.join(outputDir, 'build-id.txt'), buildId, 'utf8');
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
        runtimeConfig,
      ],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true,
      cacheControl: deployCacheControl,
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
      value: 'Origin Cache-Control: 60s + stale-while-revalidate; /assets/*: 1y TTL',
      description: 'Caching Strategy',
    });
  }
}
