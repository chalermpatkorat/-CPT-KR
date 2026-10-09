/**
 * Print Manager Utility
 * Manages dynamic paper orientation (Landscape / Portrait)
 * and print settings (Copies / Page limit)
 */

export type PrintOrientation = 'landscape' | 'portrait';

export interface PrintSettings {
  orientation: PrintOrientation;
  copies: number;
  pageRange?: 'all' | '1' | '2';
}

/**
 * Injects or updates the dynamic print style in document.head
 */
export const applyPrintOrientation = (orientation: PrintOrientation) => {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('dynamic-print-orientation-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-orientation-style';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    @media print {
      @page {
        size: ${orientation};
        margin: 8mm 8mm 8mm 8mm;
      }
    }
  `;

  if (orientation === 'portrait') {
    document.body.classList.add('print-portrait');
    document.body.classList.remove('print-landscape');
  } else {
    document.body.classList.add('print-landscape');
    document.body.classList.remove('print-portrait');
  }
};

/**
 * Triggers the browser print dialog with the requested orientation
 */
export const triggerPrint = (orientation: PrintOrientation = 'landscape') => {
  applyPrintOrientation(orientation);
  // Slight timeout to ensure style rule is registered by the browser rendering engine
  setTimeout(() => {
    window.print();
  }, 120);
};
