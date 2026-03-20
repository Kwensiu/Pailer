import Anser from 'anser';

// Create a singleton instance
const anser = new Anser();

export interface AnsiSegment {
  content: string;
  fg?: string;
  bg?: string;
  decoration?: string;
  clearLine?: boolean;
  isEmpty?: boolean;
}

const normalizeAnsiColor = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  // anser returns colors as "r, g, b" for inline styles
  if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(value)) return `rgb(${value})`;
  return value;
};

export const ansiToSegments = (text: string): AnsiSegment[] => {
  const json = (anser as any).ansiToJson(text);
  if (!Array.isArray(json)) return [{ content: text }];
  return (json as AnsiSegment[]).map((seg) => ({
    ...seg,
    fg: normalizeAnsiColor(seg.fg),
    bg: normalizeAnsiColor(seg.bg),
  }));
};

/**
 * Convert ANSI escape codes to HTML with inline styles (backward compatibility)
 * @param text - Text containing ANSI codes
 * @returns HTML string with styled spans
 */
export const ansiToHtml = (text: string): string => {
  const segments = ansiToSegments(text);
  return segments
    .map((seg) => {
      const styles: string[] = [];
      if (seg.fg) styles.push(`color:${seg.fg}`);
      if (seg.bg) styles.push(`background-color:${seg.bg}`);
      if (seg.decoration) styles.push(`text-decoration:${seg.decoration}`);
      const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
      // Escape HTML content to prevent XSS
      const escapedContent = seg.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      return `<span${styleAttr}>${escapedContent}</span>`;
    })
    .join('');
};

/**
 * Check if text contains ANSI escape codes
 */
export const hasAnsiCodes = (text: string): boolean => {
  // anser doesn't have a direct detect method, so we check if stripping changes the text
  return anser.ansiToText(text) !== text;
};

/**
 * Helper function to strip ANSI escape codes
 * @param str - String with ANSI codes
 * @returns String without ANSI codes
 */
export const stripAnsi = (str: string): string => {
  return anser.ansiToText(str);
};
