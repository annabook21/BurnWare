/**
 * Shared Form Layout Components
 * 98.css handles input borders/fonts via element selectors.
 * These provide layout (width, spacing) and focus rings only.
 * File size: ~55 lines
 */

import styled from 'styled-components';
import { aimTheme } from '../../theme/aim-theme';

/** Wrapper with bottom margin */
export const Field = styled.div`
  margin-bottom: ${aimTheme.spacing.lg};
`;

/** Bold label block */
export const FieldLabel = styled.label`
  display: block;
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.xs};
`;

/** Small gray hint text */
export const HelpText = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
`;

/** Full-width input with focus ring */
export const FullInput = styled.input`
  width: 100%;
  border: none;

  &:focus {
    outline: 1px dotted ${aimTheme.colors.black};
    outline-offset: -2px;
  }
`;

/** Full-width textarea with focus ring */
export const FullTextArea = styled.textarea`
  width: 100%;
  border: none;
  resize: vertical;

  &:focus {
    outline: 1px dotted ${aimTheme.colors.black};
    outline-offset: -2px;
  }
`;

/** Full-width select */
export const FullSelect = styled.select`
  width: 100%;
  border: none;
`;

/** Right-aligned button row */
export const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  justify-content: flex-end;
  margin-top: auto;
`;
