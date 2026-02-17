/**
 * Shared Button Components
 * Replaces per-file button styled-components with a consistent set.
 * 98.css provides box-shadow borders — these only add cursor, sizing, and brand colors.
 * File size: ~80 lines
 */

import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

/** Base 98.css button — no border (box-shadow provides the 3D look) */
export const Button98 = styled.button`
  padding: 4px 12px;
  border: none;
  cursor: pointer;
  font-size: ${aimTheme.fonts.size.normal};
  font-family: ${aimTheme.fonts.primary};
  min-width: 75px;
  min-height: 23px;

  &:disabled {
    color: ${aimTheme.colors.darkGray};
    cursor: default;
  }

  &:focus {
    outline: 1px dotted ${aimTheme.colors.black};
    outline-offset: -4px;
  }
`;

/** Flame gradient for primary actions (Create, Save) */
export const PrimaryButton = styled(Button98)`
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  color: ${aimTheme.colors.white};
  font-weight: ${aimTheme.fonts.weight.bold};
  text-shadow: ${aimTheme.shadows.text};

  &:disabled {
    opacity: 0.6;
    color: ${aimTheme.colors.white};
  }
`;

/** Fire gradient for destructive actions (Burn, Delete) */
export const BurnButton = styled(Button98)`
  background: linear-gradient(to bottom, ${aimTheme.colors.brandOrange}, ${aimTheme.colors.fireRed});
  color: ${aimTheme.colors.white};
  font-weight: ${aimTheme.fonts.weight.bold};
  text-shadow: ${aimTheme.shadows.text};

  &:disabled {
    opacity: 0.6;
    color: ${aimTheme.colors.white};
  }
`;

/** Green gradient for approve actions */
export const ApproveButton = styled(Button98)`
  background: linear-gradient(to bottom, #90ee90, #32cd32);
  color: ${aimTheme.colors.white};
  font-weight: ${aimTheme.fonts.weight.bold};

  &:disabled { opacity: 0.6; color: ${aimTheme.colors.white}; }
`;

/** Red gradient for reject actions */
export const RejectButton = styled(Button98)`
  background: linear-gradient(to bottom, #ffcccb, #ff6b6b);
  color: ${aimTheme.colors.white};
  font-weight: ${aimTheme.fonts.weight.bold};

  &:disabled { opacity: 0.6; color: ${aimTheme.colors.white}; }
`;

/** Text-link style button (no 98.css chrome) */
export const LinkButton = styled.button`
  background: none;
  border: none;
  box-shadow: none;
  color: ${aimTheme.colors.blue};
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font-size: ${aimTheme.fonts.size.normal};
  font-family: ${aimTheme.fonts.primary};

  &:hover {
    color: ${aimTheme.colors.brandBlue};
  }
`;
