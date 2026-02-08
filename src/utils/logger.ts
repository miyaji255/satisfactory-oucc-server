/**
 * Logger utility with timestamps
 */

// DateTimeFormat instance for Asia/Tokyo
const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Format date to Asia/Tokyo timezone using Intl.DateTimeFormat
 */
function formatTimestamp(date: Date): string {
  return dateFormatter.format(date);
}

/**
 * Log info message with timestamp
 */
export function log(message: string, ...args: unknown[]): void {
  const timestamp = formatTimestamp(new Date());
  console.log(`[${timestamp}] ${message}`, ...args);
}

/**
 * Log error message with timestamp
 */
export function logError(message: string, ...args: unknown[]): void {
  const timestamp = formatTimestamp(new Date());
  console.error(`[${timestamp}] ERROR: ${message}`, ...args);
}
