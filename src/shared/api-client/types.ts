export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiErrorBody {
  code?: string;
  error?: string; // Standard error message from backend
  message?: string; // Fallback for error message
  fields?: Record<string, string[]>;
}
