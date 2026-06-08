/**
 * Shared color constants for server-side document generation (docx, pdf).
 * These CANNOT use CSS variables — they're used in Node.js context.
 * Keep synced with public/css/style.css :root values.
 */

export const DOCX_COLORS = {
  // Body / text
  bodyText: '1a1a2e',
  titleText: '000000',
  labelText: '333333',
  mutedText: '888888',
  whiteText: 'FFFFFF',
  linkUnderline: '0000FF',

  // Document structure
  headerBg: 'F0F0F0',
  headerText: '999999',
  summaryBg: 'F0F0F0',
  rowAlt: 'FAFAFA',
  infoBg: 'F9F9F9',
  noteBg: 'FFFBE6',
  noteBorder: 'F5A623',

  // Table borders
  tableBorder: 'CCCCCC',
  lightBorder: 'DDDDDD',
  innerBorder: 'E0E0E0',

  // Brand
  brandRed: 'CC0000',

  // Print surfaces
  pageBg: 'FFFFFF',
  cardBg: 'F9F9F9',
  tableHeaderBg: 'F0F0F0',

  // Semantic (shared with CSS vars where possible)
  success: '10B981',
  successHover: '34D399',
  danger: 'EF4444',
  dangerHover: 'F87171',
  warn: 'F59E0B',
  warnHover: 'FBBF24',
  accent: '6366F1',
  accentHover: '818CF8',
  accent2: '8B5CF6',
} as const;
