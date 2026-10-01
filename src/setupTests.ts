import '@testing-library/jest-dom';

const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
})();

try {
  delete (globalThis as any).localStorage;
} catch  {}

Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
  enumerable: true
});

if (typeof window !== 'undefined') {
  try {
    delete (window as any).localStorage;
  } catch  {}
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
    enumerable: true
  });
  window.HTMLCanvasElement.prototype.getContext = () => null as any;

  if (!window.localStorage) {
    const store: Record<string, string> = {};
    const storageMock = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; }
    };
    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      writable: true
    });
  }
}
