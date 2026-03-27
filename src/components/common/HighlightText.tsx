import { createMemo } from 'solid-js';

interface HighlightTextProps {
  text: string;
  query: string;
  class?: string;
}

/**
 * A general text highlighting component
 * Supports highlighting search keywords in text
 */
const HighlightText = (props: HighlightTextProps) => {
  const highlightedText = createMemo(() => {
    const query = props.query.trim();
    if (!query) return props.text;

    // Escape regex special characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    const parts = [];
    let lastIndex = 0;
    let match;

    // Reset regex lastIndex to ensure consistent behavior
    regex.lastIndex = 0;

    while ((match = regex.exec(props.text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(props.text.slice(lastIndex, match.index));
      }
      // Add highlighted match text
      parts.push(<strong class="text-info font-bold">{match[0]}</strong>);
      lastIndex = match.index + match[0].length;

      // Prevent infinite loop caused by zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    // Add remaining text after the match
    if (lastIndex < props.text.length) {
      parts.push(props.text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [props.text];
  });

  return <span class={props.class}>{highlightedText()}</span>;
};

export default HighlightText;
