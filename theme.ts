// Theme configuration based on mockup design

export const COLORS = {
  // Main colors
  background: '#1a1a1a',
  backgroundGradientStart: '#2a1a1a', // Dark red tint
  backgroundGradientEnd: '#1a1a1a',   // Pure dark
  cardBackground: '#2a2a2a',
  primary: '#ff5252',
  primaryDark: '#d32f2f',
  
  // Text colors
  text: '#ffffff',
  textSecondary: '#999999',
  
  // UI colors
  border: '#3a3a3a',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#ff5252',
};

export const FONTS = {
  ndot: 'Ndot57',           // For app name and special text
  ndotCaps: 'Ndot57Caps',   // For headings
  system: 'System',         // Fallback to system (like Times)
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
};

// Use this in your components:
// import { COLORS, FONTS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme';