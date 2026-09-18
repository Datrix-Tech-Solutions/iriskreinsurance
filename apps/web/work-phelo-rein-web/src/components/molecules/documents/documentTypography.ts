import type { CSSProperties } from 'react';

//document formatting styles
export const documentRootStyle = {
  '--doc-font-title': 'var(--font-app), system-ui, sans-serif',
  '--doc-font-header': 'var(--font-app), system-ui, sans-serif',
  '--doc-font-content': 'var(--font-app), system-ui, sans-serif',
  '--doc-space-section': '1.4em',
  '--doc-space-row': '0.4em',
  '--doc-space-inline': '0.75em',
  fontFamily: 'var(--doc-font-content)',
} as CSSProperties;
