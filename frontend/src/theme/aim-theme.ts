/**
 * AIM Theme Configuration
 * Color palette and design tokens for BurnWare AIM aesthetic
 * File size: ~85 lines
 */

export const aimTheme = {
  colors: {
    // BurnWare brand colors (from logo)
    brandOrange: '#FF6B35',
    brandBlue: '#003366',
    fireRed: '#FF4500',
    darkBlue: '#003366',
    flameYellow: '#FFB84D',

    // Classic AIM colors
    blue: '#0066CC',
    blueGradientStart: '#0831D9',
    blueGradientEnd: '#1084D0',
    gray: '#C0C0C0',
    lightGray: '#E0E0E0',
    darkGray: '#808080',
    white: '#FFFFFF',
    black: '#000000',
    desktopTeal: '#008080',

    // Status colors
    active: '#00FF00',
    green: '#32CD32',
    expiring: '#FFB84D',
    expired: '#808080',
    newMessage: '#FF6B35',

    // UI colors
    menuHover: '#316AC5',
    lightYellow: '#FFFDE7',
    messageOwn: '#DCF8C6',
  },

  fonts: {
    primary: "'Tahoma', 'MS Sans Serif', sans-serif",
    size: {
      tiny: '9px',
      small: '10px',
      normal: '11px',
      medium: '13px',
      large: '16px',
    },
    weight: {
      normal: 400,
      bold: 700,
    },
  },

  spacing: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },

  borders: {
    solid: '1px solid #808080',
  },

  shadows: {
    window: '2px 2px 8px rgba(0, 0, 0, 0.3)',
    button: '1px 1px 2px rgba(0, 0, 0, 0.2)',
    text: '1px 1px 2px rgba(0, 0, 0, 0.5)',
  },

  zIndex: {
    base: 1,
    window: 100,
    modal: 1000,
    tooltip: 2000,
  },
} as const;

export type AIMTheme = typeof aimTheme;
