export const getApiConfig = () => {
  const token = localStorage.getItem('dashboard_token');
  return {
    baseUrl: 'http://localhost:3001',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};
