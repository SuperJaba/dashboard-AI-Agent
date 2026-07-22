import { ApiError } from './error';
import type { HttpMethod, RequestOptions } from './types';
import { getApiConfig } from './config';

async function request<T>(method: HttpMethod, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const config = getApiConfig();
  
  let url = path.startsWith('http') ? path : `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  
  if (options?.params) {
    const params = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      method,
      headers: { ...config.headers, ...options?.headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw ApiError.fromNetwork(err);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    if (!response.ok) {
      throw new ApiError('Invalid response format', response.status, 'INVALID_RESPONSE');
    }
    throw new ApiError('Invalid JSON response', response.status, 'INVALID_JSON');
  }

  if (!response.ok) {
    throw ApiError.fromEnvelope(data, response.status);
  }

  // The backend might send { data: ... } or just raw payload. We handle both cleanly.
  if (data && typeof data === 'object' && 'data' in data && Object.keys(data).length === 1) {
    return data.data as T;
  }
  
  return data as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options);
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, options);
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, options);
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', path, body, options);
  },
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options);
  },
} as const;

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('dashboard_token');
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export type ApiClient = typeof apiClient;
