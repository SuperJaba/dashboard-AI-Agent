import '@testing-library/jest-dom';

// Mock canvas for xterm.js
if (typeof window !== 'undefined') {
  window.HTMLCanvasElement.prototype.getContext = () => null as any;
}
