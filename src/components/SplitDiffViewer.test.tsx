import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SplitDiffViewer } from './SplitDiffViewer';

describe('SplitDiffViewer', () => {
  const sampleDiff = `diff --git a/src/index.js b/src/index.js
--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,3 @@
-const port = 3000;
+const port = 3001;
 console.log('started');`;

  it('renders diff lines with additions and deletions', () => {
    render(
      <SplitDiffViewer
        diff={sampleDiff}
        agentName="Gemini 1.5 Pro"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Gemini 1.5 Pro/i)).toBeInTheDocument();
    expect(screen.getByText(/3000/i)).toBeInTheDocument();
    expect(screen.getByText(/3001/i)).toBeInTheDocument();
    expect(screen.getByText(/Porównanie Wyników/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <SplitDiffViewer
        diff={sampleDiff}
        agentName="Claude 3.5 Sonnet"
        onClose={handleClose}
      />
    );

    const closeButtons = screen.getAllByRole('button', { name: /Zamknij/i });
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders apply button and triggers callback if provided', () => {
    const handleApply = vi.fn();
    render(
      <SplitDiffViewer
        diff={sampleDiff}
        agentName="Aider"
        onApply={handleApply}
        onClose={vi.fn()}
      />
    );

    const applyBtn = screen.getByRole('button', { name: /Zastosuj wynik/i });
    expect(applyBtn).toBeInTheDocument();
    fireEvent.click(applyBtn);
    expect(handleApply).toHaveBeenCalled();
  });
});
