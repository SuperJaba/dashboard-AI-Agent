export const getApiConfig = () => {
  const token = localStorage.getItem('dashboard_token');
  const baseUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');
  return {
    baseUrl,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};
