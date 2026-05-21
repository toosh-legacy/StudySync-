export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
  NO_CONTENT: 'NO_CONTENT',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: ErrorCodeValue;
  message: string;
  status: number;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  status: number;
  body: ApiErrorBody;
}

export function apiError(
  code: ErrorCodeValue,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): ApiErrorPayload {
  return {
    status,
    body: { error: code, message, status, ...(extra ?? {}) },
  };
}

export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'body' in value
  );
}
