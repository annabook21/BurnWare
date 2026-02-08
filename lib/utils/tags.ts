/**
 * Tagging utilities for AWS resources
 * File size: ~70 lines
 */

import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { APP_NAME } from '../config/constants';

export interface TagConfig {
  environment: string;
  owner?: string;
  project?: string;
  costCenter?: string;
}

export class TagUtils {
  /**
   * Apply standard tags to a construct
   */
  static applyStandardTags(construct: IConstruct, config: TagConfig): void {
    Tags.of(construct).add('Application', APP_NAME);
    Tags.of(construct).add('Environment', config.environment);
    Tags.of(construct).add('ManagedBy', 'CDK');

    if (config.owner) {
      Tags.of(construct).add('Owner', config.owner);
    }

    if (config.project) {
      Tags.of(construct).add('Project', config.project);
    }

    if (config.costCenter) {
      Tags.of(construct).add('CostCenter', config.costCenter);
    }
  }

  /**
   * Apply tier tag for 3-tier architecture
   */
  static applyTierTag(construct: IConstruct, tier: 'presentation' | 'application' | 'data'): void {
    Tags.of(construct).add('Tier', tier);
  }

  /**
   * Apply compliance tags
   */
  static applyComplianceTags(construct: IConstruct, compliance: string[]): void {
    Tags.of(construct).add('Compliance', compliance.join(','));
  }

  /**
   * Apply backup tag
   */
  static applyBackupTag(construct: IConstruct, backupSchedule: string): void {
    Tags.of(construct).add('Backup', backupSchedule);
  }
}
