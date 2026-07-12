export const apiFetch = (url: string, options: any = {}) => {
  const token = localStorage.getItem('dashboard_token');
  const finalUrl = url.startsWith('/') ? `http://localhost:3001${url}` : url;
  return fetch(finalUrl, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
};
