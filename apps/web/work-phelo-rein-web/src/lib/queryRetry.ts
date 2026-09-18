const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404, 409, 422, 429]);

function httpStatusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = httpStatusFromError(error);

  if (status && NON_RETRYABLE_HTTP_STATUSES.has(status)) {
    return false;
  }

  return failureCount < 1;
}
