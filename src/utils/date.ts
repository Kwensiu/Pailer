export function formatIsoDate(isoString: string): string {
  if (!isoString) {
    return 'N/A';
  }

  try {
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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
    return new Date(dateString).toLocaleDateString();
  } catch (error) {
    console.error('Failed to format bucket date:', dateString, error);
    return 'Invalid Date';
  }
}
