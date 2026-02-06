/**
 * Status Indicator Component
 * Shows link status with fire theme
 * File size: ~70 lines
 */

import React from 'react';
import styled from 'styled-components';

import type { StatusType } from '../../types';

interface StatusIndicatorProps {
  status: StatusType;
  size?: number;
}

const StatusIcon = styled.span<{ size: number }>`
  font-size: ${(props) => props.size}px;
  line-height: 1;
  display: inline-block;
`;

const statusIcons: Record<StatusType, string> = {
  active: '🔥',
  expiring: '💨',
  expired: '⚫',
};

const statusLabels: Record<StatusType, string> = {
  active: 'Active',
  expiring: 'Expiring Soon',
  expired: 'Expired',
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, size = 14 }) => {
  return (
    <StatusIcon size={size} title={statusLabels[status]} aria-label={statusLabels[status]}>
      {statusIcons[status]}
    </StatusIcon>
  );
};
