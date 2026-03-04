import DOMPurify from 'dompurify';

/**
 * Simple markdown processor using only JavaScript built-ins
 * Follows KISS principle - no external dependencies for markdown parsing
 */
export async function processMarkdown(content: string): Promise<string> {
  if (!content.trim()) return '';

  try {
    let html = content;

    // Process in order of specificity (most specific first)

    // Code blocks (fenced) - escape HTML entities for security
    html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre class="bg-gray-100 dark:bg-gray-800 text-base-content p-4 rounded-lg overflow-x-auto text-sm font-mono border border-gray-200 dark:border-gray-700 my-3"><code>${escaped}</code></pre>`;
    });

    // Tables (basic support)
    html = html.replace(/^\|(.+)\|$/gm, (_match, content) => {
      const cells = content.split('|').map((cell: string) => cell.trim());
      // Check if this row contains only dashes (table separator)
      const isHeaderSeparator = cells.every((cell: string) => /^-+$/.test(cell.trim()));
      const isHeader = isHeaderSeparator;
      const tag = isHeader ? 'th' : 'td';
      const className = isHeader
        ? 'border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-base-content'
        : 'border border-gray-300 dark:border-gray-600 px-4 py-2 text-base-content';

      return `<tr>${cells.map((cell: string) => `<${tag} class="${className}">${cell}</${tag}>`).join('')}</tr>`;
    });

    // Wrap consecutive table rows
    html = html.replace(
      /(<tr>.*?<\/tr>\n?)+/g,
      '<table class="border-collapse border border-gray-300 dark:border-gray-600 my-4">$&</table>'
    );

    // Blockquotes
    html = html.replace(
      /^> (.+)$/gm,
      '<blockquote class="border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/20 pl-4 italic text-base-content/80 my-4 py-2">$1</blockquote>'
    );

    // Headers (process from most specific to least)
    html = html.replace(
      /^###### (.*$)/gm,
      '<h6 class="text-sm font-semibold mb-2 mt-3 text-base-content">$1</h6>'
    );
    html = html.replace(
      /^##### (.*$)/gm,
      '<h5 class="text-sm font-semibold mb-2 mt-3 text-base-content">$1</h5>'
    );
    html = html.replace(
      /^#### (.*$)/gm,
      '<h4 class="text-base font-semibold mb-3 mt-4 text-base-content">$1</h4>'
    );
    html = html.replace(
      /^### (.*$)/gm,
      '<h3 class="text-lg font-semibold mb-3 mt-4 text-base-content">$1</h3>'
    );
    html = html.replace(
      /^## (.*$)/gm,
      '<h2 class="text-xl font-bold mb-3 mt-5 text-base-content">$1</h2>'
    );
    html = html.replace(
      /^# (.*$)/gm,
      '<h1 class="text-2xl font-bold mb-4 mt-6 text-base-content">$1</h1>'
    );

    // Lists (unordered)
    html = html.replace(/^[-*+] (.+)$/gm, '<li class="leading-relaxed">• $1</li>');
    html = html.replace(
      /(<li class="leading-relaxed">• .*<\/li>\n?)+/g,
      '<ul class="list-disc space-y-2 ml-6 text-sm text-base-content/90">$&</ul>'
    );

    // Lists (ordered)
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="leading-relaxed">$1</li>');
    html = html.replace(
      /(<li class="leading-relaxed">(?!\s*•).*<\/li>\n?)+/g,
      '<ol class="list-decimal space-y-2 ml-6 text-sm text-base-content/90">$&</ol>'
    );

    // Links
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline transition-colors">$1</a>'
    );

    // Inline code
    html = html.replace(
      /`([^`]+)`/g,
      '<code class="bg-gray-100 dark:bg-gray-800 text-base-content px-1.5 py-0.5 rounded text-sm font-mono border border-gray-200 dark:border-gray-700">$1</code>'
    );

    // Bold and italic (process *** first to avoid conflicts)
    html = html.replace(
      /\*\*\*(.+?)\*\*\*/g,
      '<strong class="font-semibold"><em class="italic">$1</em></strong>'
    );
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

    // Paragraphs (anything left that's not already HTML)
    html = html.replace(/^(?!<[^>]+>)(.+)$/gm, (_match, content) => {
      if (content.trim()) {
        return `<p class="text-sm text-base-content/85 leading-relaxed mb-3">${content}</p>`;
      }
      return content;
    });

    // Clean up extra line breaks
    html = html.replace(/\n\s*\n/g, '\n');

    // IMPORTANT: Apply DOMPurify after all transformations to ensure security
    return DOMPurify.sanitize(html);
  } catch (error) {
    // Simple fallback with minimal styling
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>'
      )
      .replace(
        /\[(.*?)\]\((.*?)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
      )
      .replace(/\n/g, '<br>');
  }
}
