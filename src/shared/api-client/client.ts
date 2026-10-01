import { ApiError } from './error';
import type { HttpMethod, RequestOptions } from './types';
import { getApiConfig } from './config';

/**
 * Core generic request function that handles formatting URLs, appending query parameters,
 * setting headers (including auth via getApiConfig), and processing JSON responses.
 *
 * @param method - The HTTP method to use (e.g., 'GET', 'POST').
 * @param path - The URL path or full URL.
 * @param body - Optional request body to be stringified as JSON.
 * @param options - Additional fetch options and query parameters.
 * @returns A promise that resolves to the strongly typed response data.
 * @throws {ApiError} If the network request fails or the server returns an error.
 */
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
  } catch  {
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

/**
 * Strongly typed HTTP client for making API requests.
 * Simplifies REST calls with built-in error handling and JSON parsing.
 */
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

/**
 * A wrapper around the native fetch API that automatically injects
 * the JWT authorization token from localStorage.
 *
 * @param input - The resource URL.
 * @param init - The standard fetch init options.
 * @returns A promise resolving to the standard Response object.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let finalInput = input;
  if (typeof input === 'string' && input.startsWith('/')) {
    finalInput = `${getApiConfig().baseUrl}${input}`;
  }
  
  const token = localStorage.getItem('dashboard_token');
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(finalInput, { ...init, headers });
}

export type ApiClient = typeof apiClient;
