/**
 * X-Ray Configuration
 * AWS X-Ray SDK setup for distributed tracing
 * File size: ~75 lines
 */

import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';
import { logger } from './logger';

/**
 * Initialize X-Ray SDK
 * https://docs.aws.amazon.com/xray/latest/devguide/xray-services-ec2.html
 */
export function initializeXRay(): void {
  if (process.env.ENABLE_XRAY !== 'false') {
    // Capture AWS SDK calls
    AWSXRay.captureAWS(AWS);

    // Configure X-Ray
    AWSXRay.config([AWSXRay.plugins.EC2Plugin]);

    // Set context missing strategy
    AWSXRay.setContextMissingStrategy('LOG_ERROR');

    logger.info('X-Ray tracing initialized');
  } else {
    logger.info('X-Ray tracing disabled');
  }
}

/**
 * Get current trace ID
 */
export function getTraceId(): string | undefined {
  try {
    const segment = AWSXRay.getSegment();
    return segment?.trace_id;
  } catch {
    return undefined;
  }
}

/**
 * Create subsegment for operation
 */
export function createSubsegment(name: string) {
  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      return segment.addNewSubsegment(name);
    }
  } catch {
    return null;
  }
  return null;
}

export { AWSXRay };
