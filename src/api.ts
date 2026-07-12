export const API_TOKEN = 'dashboard-secret-token';

export const apiFetch = (url: string, options: any = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${API_TOKEN}`
    }
  });
};
