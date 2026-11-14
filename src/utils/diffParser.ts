export interface DiffRow {
  type: 'header' | 'hunk' | 'diff';
  header?: string;
  left?: {
    lineNum: number;
    text: string;
    type: 'context' | 'removed';
  } | null;
  right?: {
    lineNum: number;
    text: string;
    type: 'context' | 'added';
  } | null;
}

/**
 * Parses unified diff text into paired rows for side-by-side (left | right) display.
 */
export function parseUnifiedDiff(diffText: string): DiffRow[] {
  if (!diffText || typeof diffText !== 'string') return [];

  const lines = diffText.split(/\r?\n/);
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('new file mode') ||
      line.startsWith('deleted file mode')
    ) {
      rows.push({ type: 'header', header: line });
      i++;
      continue;
    }

    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      rows.push({ type: 'hunk', header: line });
      i++;
      continue;
    }

    // Check for modifications / deletions
    if (line.startsWith('-')) {
      const removedLines: { text: string; lineNum: number }[] = [];
      const addedLines: { text: string; lineNum: number }[] = [];

      while (i < lines.length && lines[i].startsWith('-') && !lines[i].startsWith('---')) {
        removedLines.push({ text: lines[i].slice(1), lineNum: oldLine++ });
        i++;
      }
      while (i < lines.length && lines[i].startsWith('+') && !lines[i].startsWith('+++')) {
        addedLines.push({ text: lines[i].slice(1), lineNum: newLine++ });
        i++;
      }

      const maxLen = Math.max(removedLines.length, addedLines.length);
      for (let j = 0; j < maxLen; j++) {
        const left = removedLines[j] || null;
        const right = addedLines[j] || null;
        rows.push({
          type: 'diff',
          left: left ? { lineNum: left.lineNum, text: left.text, type: 'removed' } : null,
          right: right ? { lineNum: right.lineNum, text: right.text, type: 'added' } : null,
        });
      }
      continue;
    }

    if (line.startsWith('+')) {
      rows.push({
        type: 'diff',
        left: null,
        right: { lineNum: newLine++, text: line.slice(1), type: 'added' },
      });
      i++;
      continue;
    }

    if (line.startsWith(' ')) {
      rows.push({
        type: 'diff',
        left: { lineNum: oldLine++, text: line.slice(1), type: 'context' },
        right: { lineNum: newLine++, text: line.slice(1), type: 'context' },
      });
      i++;
      continue;
    }

    if (line.length > 0) {
      rows.push({ type: 'header', header: line });
    }
    i++;
  }

  return rows;
}
