/**
 * GitHub theme JSON syntax highlighter
 * Lightweight, no dependencies, works in browser
 * Supports both light and dark themes
 */

const themes = {
  dark: {
    keyColor: '#7ee787',
    stringColor: '#a5d6ff',
    valueColor: '#79c0ff',
    linkColor: '#4493f8',
    punctuationColor: '#c9d1d9',
  },
  light: {
    keyColor: '#0550ae',
    stringColor: '#0a3069',
    valueColor: '#0550ae',
    linkColor: '#0969da',
    punctuationColor: '#1f2328',
  },
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function linkifyEscapedText(escaped: string, linkColor: string): string {
  // escaped text means it doesn't contain <, >, &
  const urlRegex = /(https?:\/\/[^\s"']+|www\.[^\s"']+)/g;
  let out = '';
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(escaped)) !== null) {
    out += escaped.slice(lastIdx, m.index);
    const raw = m[0];
    const href = raw.startsWith('www.') ? `http://${raw}` : raw;
    out += `<a href="${href}" style="color:${linkColor};text-decoration:underline;" target="_blank" rel="noopener noreferrer">${raw}</a>`;
    lastIdx = urlRegex.lastIndex;
  }
  out += escaped.slice(lastIdx);
  return out;
}

function resolveTheme(theme: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  if (theme !== 'system') return theme;

  if (typeof window !== 'undefined') {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    if (typeof prefersDark === 'boolean') {
      return prefersDark ? 'dark' : 'light';
    }

    const dataTheme = document.documentElement.getAttribute('data-theme');
    if (dataTheme === 'dark' || dataTheme === 'light') {
      return dataTheme;
    }
  }

  return 'dark';
}

// Fast JSON highlighter: single pass, no post-processing replaces (prevents nested span corruption)
export function highlightJson(json: any, theme: 'dark' | 'light' | 'system' = 'dark'): string {
  const colors = themes[resolveTheme(theme)];
  const jsonString = typeof json === 'string' ? json : JSON.stringify(json, null, 2);

  let i = 0;
  const n = jsonString.length;
  let out = '';

  const isWhitespace = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t';
  const isDigit = (c: string) => c >= '0' && c <= '9';
  const startsWithAt = (s: string) => jsonString.startsWith(s, i);

  while (i < n) {
    const c = jsonString[i];

    // Strings
    if (c === '"') {
      const start = i;
      i++;
      let escaped = false;
      while (i < n) {
        const ch = jsonString[i];
        if (escaped) {
          escaped = false;
          i++;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          i++;
          continue;
        }
        if (ch === '"') {
          i++; // include closing quote
          break;
        }
        i++;
      }
      const rawQuoted = jsonString.slice(start, i); // includes quotes

      // Look ahead to decide if key
      let j = i;
      while (j < n && isWhitespace(jsonString[j])) j++;
      const isKey = j < n && jsonString[j] === ':';

      const inner = rawQuoted.slice(1, -1);
      const escapedInner = escapeHtml(inner);

      if (isKey) {
        out += `<span style="color:${colors.keyColor}">"${escapedInner}"</span>`;
      } else {
        const linked = linkifyEscapedText(escapedInner, colors.linkColor);
        out += `<span style="color:${colors.stringColor}">"${linked}"</span>`;
      }
      continue;
    }

    // Punctuation
    if (c === '{' || c === '}' || c === '[' || c === ']' || c === ',' || c === ':') {
      out += `<span style="color:${colors.punctuationColor}">${c}</span>`;
      i++;
      continue;
    }

    // Literals
    if (startsWithAt('true')) {
      out += `<span style="color:${colors.valueColor}">true</span>`;
      i += 4;
      continue;
    }
    if (startsWithAt('false')) {
      out += `<span style="color:${colors.valueColor}">false</span>`;
      i += 5;
      continue;
    }
    if (startsWithAt('null')) {
      out += `<span style="color:${colors.valueColor}">null</span>`;
      i += 4;
      continue;
    }

    // Number
    if (c === '-' || isDigit(c)) {
      const start = i;
      i++;
      while (i < n) {
        const ch = jsonString[i];
        if (isDigit(ch) || ch === '.' || ch === 'e' || ch === 'E' || ch === '+' || ch === '-') {
          i++;
        } else {
          break;
        }
      }
      const num = jsonString.slice(start, i);
      out += `<span style="color:${colors.valueColor}">${num}</span>`;
      continue;
    }

    // Whitespace / other
    out += escapeHtml(c);
    i++;
  }

  return out;
}
