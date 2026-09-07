import { ApiResponse, ApiError, PaginationMeta } from '@work-phelo/types';

export function successResponse<T>(
  data: T,
  message = 'Success',
  meta?: PaginationMeta,
): ApiResponse<T> {
  return { success: true, data, message, ...(meta && { meta }) };
}

export function errorResponse(
  code: string,
  message: string,
  details?: { field: string; message: string }[],
): ApiError {
  return { success: false, error: { code, message, ...(details && { details }) } };
}
