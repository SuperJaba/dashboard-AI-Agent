/**
 * Strips ANSI color codes and leftover escape codes (such as [0m) from strings.
 */
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\x1b]\[[0-9;]*[a-zA-Z]/g;
const ORPHANED_ANSI_REGEX = /\[[0-9;]+m/g;

export function cleanLogLine(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(ANSI_REGEX, '')
    .replace(ORPHANED_ANSI_REGEX, '')
    .replace(/\r/g, '')
    .trim();
}
