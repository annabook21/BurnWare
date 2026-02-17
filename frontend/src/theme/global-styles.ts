/**
 * Global Styles
 * Integrates 98.css with BurnWare AIM theme
 * File size: ~120 lines
 */

import { createGlobalStyle } from 'styled-components';
import { aimTheme } from './aim-theme';

export const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  body {
    background: ${aimTheme.colors.desktopTeal};
    font-family: ${aimTheme.fonts.primary};
    font-size: ${aimTheme.fonts.size.normal};
    color: ${aimTheme.colors.black};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    width: 100%;
    height: 100%;
  }

  /* 98.css sets buttons to color:transparent + text-shadow. Override globally
   * so all button text is visible. */
  button {
    color: inherit;
    text-shadow: none;
  }

  /* 98.css forces select height:21px — override globally */
  select {
    height: auto;
  }

  /* Title-bar control buttons get 98.css SVG icons via aria-label */
  .title-bar-controls button {
    color: ${aimTheme.colors.black};
    text-shadow: none;
  }

  /* Burn button (fire-themed) */
  .btn-burn {
    background: linear-gradient(to bottom, ${aimTheme.colors.brandOrange}, ${aimTheme.colors.fireRed});
    color: ${aimTheme.colors.white};
    border: 2px outset ${aimTheme.colors.fireRed};
    font-weight: bold;
    text-shadow: ${aimTheme.shadows.text};

    &:hover {
      background: linear-gradient(to bottom, #FF8C55, #FF6520);
    }

    &:active {
      border-style: inset;
    }
  }

  /* Status indicators */
  .status-active::before {
    content: '🔥';
    margin-right: 4px;
  }

  .status-expiring::before {
    content: '💨';
    margin-right: 4px;
  }

  .status-expired::before {
    content: '⚫';
    margin-right: 4px;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 16px;
  }

  ::-webkit-scrollbar-track {
    background: ${aimTheme.colors.white};
  }

  ::-webkit-scrollbar-thumb {
    background: ${aimTheme.colors.gray};
    border: 1px solid ${aimTheme.colors.darkGray};
  }
`;
