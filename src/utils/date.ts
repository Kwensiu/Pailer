import { locale } from '../i18n';

export function formatIsoDate(isoString: string): string {
  if (!isoString) {
    return 'N/A';
  }

  try {
    const date = new Date(isoString);
    const currentLocale = locale();

    if (currentLocale === 'zh') {
      // Chinese format: yyyy-mm-dd
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else {
      // English format: dd-mm-yyyy
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch (error) {
    console.error('Failed to format date:', isoString, error);
    return 'Invalid Date';
  }
}

/**
 * Formats date for bucket components (last updated display)
 * @param dateString - Date string from bucket metadata
 * @returns Formatted date string or "Unknown" for invalid/empty input
 */
export function formatBucketDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown';

  try {
    const date = new Date(dateString);
    const currentLocale = locale();
    const localeString = currentLocale === 'zh' ? 'zh-CN' : 'en-US';
    return date.toLocaleDateString(localeString);
  } catch (error) {
    console.error('Failed to format bucket date:', dateString, error);
    return 'Invalid Date';
  }
}
