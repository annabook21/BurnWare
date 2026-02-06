/**
 * Global Styles
 * Integrates 98.css with BurnWare AIM theme
 * File size: ~120 lines
 */

import { createGlobalStyle } from 'styled-components';
import { aimTheme } from './aim-theme';

export const GlobalStyles = createGlobalStyle`
  /* Import 98.css for Windows 98 aesthetic */
  @import url('98.css');

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

  /* AIM-style window */
  .aim-window {
    border: ${aimTheme.borders.outset};
    background: ${aimTheme.colors.gray};
    box-shadow: ${aimTheme.shadows.window};
  }

  /* Title bar */
  .aim-title-bar {
    background: linear-gradient(
      to right,
      ${aimTheme.colors.blueGradientStart},
      ${aimTheme.colors.blueGradientEnd}
    );
    color: ${aimTheme.colors.white};
    font-weight: ${aimTheme.fonts.weight.bold};
    padding: 3px 5px;
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
  }

  /* Classic button styling */
  .btn-98 {
    padding: 4px 12px;
    border: ${aimTheme.borders.outset};
    background: ${aimTheme.colors.gray};
    font-family: ${aimTheme.fonts.primary};
    font-size: ${aimTheme.fonts.size.normal};
    cursor: pointer;
    min-width: 75px;

    &:active {
      border-style: inset;
    }

    &:focus {
      outline: 1px dotted ${aimTheme.colors.black};
      outline-offset: -4px;
    }
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
