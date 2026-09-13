export const getApiConfig = () => {
  const token = localStorage.getItem('dashboard_token');
  // Relative baseUrl so requests go through Vite's dev proxy (see vite.config.ts),
  // which forwards to the backend port (kept in sync with .env's PORT=3001).
  // Set VITE_API_URL to override with an absolute URL when needed.
  const baseUrl = import.meta.env.VITE_API_URL ?? '';
  return {
    baseUrl,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};
