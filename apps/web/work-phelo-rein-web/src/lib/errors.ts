import { AxiosError } from 'axios';

export function extractError(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (!data) return 'Something went wrong. Please try again.';

    const message = data.message;
    if (Array.isArray(message)) return message[0] as string;
    if (typeof message === 'string') return message;
  }

  if (error instanceof Error) return error.message;

  return 'Something went wrong. Please try again.';
}
