// Example test for error handling logic.

const { fetchData } = require('../src/api');

describe('fetchData', () => {
  it('should throw when the API returns a non‑200 status', async () => {
    // Mock global.fetch to return a failed response
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 }));

    await expect(fetchData('https://example.com')).rejects.toThrow(/API error/);

    // restore
    global.fetch = originalFetch;
  });
});

