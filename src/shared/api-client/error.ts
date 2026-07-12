import type { ApiErrorBody } from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(message: string, status: number, code: string = 'UNKNOWN', fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isNetworkError() {
    return this.status === 0;
  }
  
  get hasFieldErrors() {
    return !!this.fields && Object.keys(this.fields).length > 0;
  }

  static fromNetwork(cause: unknown) {
    return new ApiError(cause instanceof Error ? cause.message : 'Network Error', 0, 'NETWORK_ERROR');
  }

  static fromEnvelope(body: ApiErrorBody, status: number) {
    const message = body.error || body.message || 'Server Error';
    return new ApiError(message, status, body.code || 'SERVER_ERROR', body.fields);
  }
}
