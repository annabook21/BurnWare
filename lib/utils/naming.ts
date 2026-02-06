/**
 * Resource naming utilities
 * File size: ~60 lines
 */

import { APP_PREFIX } from '../config/constants';

export class NamingUtils {
  /**
   * Generate consistent resource names
   */
  static getResourceName(
    resourceType: string,
    environment: string,
    suffix?: string
  ): string {
    const parts = [APP_PREFIX, environment, resourceType];
    if (suffix) {
      parts.push(suffix);
    }
    return parts.join('-');
  }

  /**
   * Generate VPC endpoint name
   */
  static getVpcEndpointName(service: string, environment: string): string {
    return this.getResourceName('vpce', environment, service);
  }

  /**
   * Generate security group name
   */
  static getSecurityGroupName(purpose: string, environment: string): string {
    return this.getResourceName('sg', environment, purpose);
  }

  /**
   * Generate IAM role name
   */
  static getIamRoleName(purpose: string, environment: string): string {
    return this.getResourceName('role', environment, purpose);
  }

  /**
   * Generate log group name
   */
  static getLogGroupName(purpose: string, environment: string): string {
    return `/aws/${APP_PREFIX}/${environment}/${purpose}`;
  }

  /**
   * Generate alarm name
   */
  static getAlarmName(metric: string, environment: string, suffix?: string): string {
    return this.getResourceName('alarm', environment, `${metric}${suffix ? `-${suffix}` : ''}`);
  }
}
