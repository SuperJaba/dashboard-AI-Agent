import '@testing-library/jest-dom';

// In Node 22+, globalThis.localStorage is undefined by default and shadows jsdom's window.localStorage.
// Also jsdom Storage throws brand checks if instantiated via Object.create.
if (typeof Storage !== 'undefined') {
  const memoryStore: Record<string, string> = {};
  Storage.prototype.getItem = function (k: string) {
    return memoryStore[k] ?? null;
  };
  Storage.prototype.setItem = function (k: string, v: string) {
    memoryStore[k] = String(v);
  };
  Storage.prototype.removeItem = function (k: string) {
    delete memoryStore[k];
  };
  Storage.prototype.clear = function () {
    for (const k of Object.keys(memoryStore)) {
      delete memoryStore[k];
    }
  };

  const mockStorage = Object.create(Storage.prototype);
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true,
    });
  }
}

// Mock canvas for xterm.js
if (typeof window !== 'undefined') {
  window.HTMLCanvasElement.prototype.getContext = () => null as any;
}
