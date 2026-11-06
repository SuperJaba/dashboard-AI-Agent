import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SplitDiffViewer } from './SplitDiffViewer';
import { parseUnifiedDiff } from '../utils/diffParser';

describe('SplitDiffViewer and parseUnifiedDiff', () => {
  const sampleDiff = `diff --git a/scripts/worker.js b/scripts/worker.js
--- a/scripts/worker.js
+++ b/scripts/worker.js
@@ -10,3 +10,3 @@
 const unchanged = true;
-const oldVal = 1;
+const newVal = 2;
 const done = true;`;

  it('parses unified diff into paired rows for split view', () => {
    const rows = parseUnifiedDiff(sampleDiff);
    expect(rows.length).toBeGreaterThan(0);

    const diffRows = rows.filter(r => r.type === 'diff');
    expect(diffRows).toHaveLength(3);

    // Unchanged line
    expect(diffRows[0].left?.text).toBe('const unchanged = true;');
    expect(diffRows[0].right?.text).toBe('const unchanged = true;');
    expect(diffRows[0].left?.type).toBe('context');

    // Modified line (removed on left, added on right)
    expect(diffRows[1].left?.text).toBe('const oldVal = 1;');
    expect(diffRows[1].left?.type).toBe('removed');
    expect(diffRows[1].right?.text).toBe('const newVal = 2;');
    expect(diffRows[1].right?.type).toBe('added');
  });

  it('renders split diff by default with Lewa | Prawa headers', () => {
    render(<SplitDiffViewer diff={sampleDiff} />);

    expect(screen.getByText(/Lewa: Oryginał/i)).toBeInTheDocument();
    expect(screen.getByText(/Prawa: Zmodyfikowana wersja/i)).toBeInTheDocument();
    expect(screen.getByText('const oldVal = 1;')).toBeInTheDocument();
    expect(screen.getByText('const newVal = 2;')).toBeInTheDocument();
  });

  it('allows switching to unified view mode', () => {
    render(<SplitDiffViewer diff={sampleDiff} />);

    const unifiedBtn = screen.getByTitle('Widok Unified (Jednokolumnowy)');
    fireEvent.click(unifiedBtn);

    expect(screen.queryByText(/Lewa: Oryginał/i)).not.toBeInTheDocument();
  });

  it('renders clean fallback when diff is empty', () => {
    render(<SplitDiffViewer diff="" />);
    expect(screen.getByText(/Brak różnic do wyświetlenia/i)).toBeInTheDocument();
  });
});
