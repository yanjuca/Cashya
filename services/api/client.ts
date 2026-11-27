import { Platform } from 'react-native';

import { signRequest } from './signing';

/**
 * Transport for cashya-api.
 *
 * Every successful response is wrapped as `{ success: true, data, message? }` and every failure as
 * `{ success: false, error: { code, message, details } }`. `apiRequest` hides that envelope: it resolves
 * with `data` already unwrapped, or rejects with an `ApiError`.
 */

const DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
export const API_PREFIX = '/api/v1';

// Must match the backend's REQUEST_SIGNING_SECRET; empty means unsigned requests (backend secret empty too).
const SIGNING_KEY = process.env.EXPO_PUBLIC_API_SIGNING_KEY || '';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: ApiErrorDetail[] };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'UNKNOWN',
    public readonly details: ApiErrorDetail[] = []
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never reached the server (offline, wrong URL, timeout). */
  get isNetworkError() {
    return this.status === 0;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  query?: Record<string, QueryValue>;
}

function buildQuery(params: Record<string, QueryValue> = {}): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return '';
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return !!value && typeof value === 'object' && (value as ErrorEnvelope).success === false && !!(value as ErrorEnvelope).error;
}

function isSuccessEnvelope<T>(value: unknown): value is SuccessEnvelope<T> {
  return !!value && typeof value === 'object' && (value as SuccessEnvelope<T>).success === true && 'data' in (value as object);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  // The signature covers the path without the query string (see app/core/hardening.py).
  const signed = SIGNING_KEY ? signRequest(SIGNING_KEY, method, `${API_PREFIX}${path}`, body) : {};

  let response: Response;
  try {
    response = await fetch(`${API_URL}${API_PREFIX}${path}${buildQuery(options.query)}`, {
      method,
      body,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...signed,
      },
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.', 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body (proxy error page, empty reply): handled below with a status-based message.
  }

  if (!response.ok || isErrorEnvelope(payload)) {
    if (isErrorEnvelope(payload)) {
      throw new ApiError(response.status, payload.error.message, payload.error.code, payload.error.details ?? []);
    }
    throw new ApiError(response.status, `Request failed with status ${response.status}`);
  }

  if (!isSuccessEnvelope<T>(payload)) {
    throw new ApiError(response.status, 'Unexpected response from the server.', 'INVALID_RESPONSE');
  }
  return payload.data;
}
