'use client';

import { isAxiosError } from 'axios';

export function ReportQueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const forbidden = isAxiosError(error) && error.response?.status === 403;

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-base font-medium text-red-700">Unable to load report</p>
      <p className="text-sm text-gray-600">
        {forbidden
          ? 'You do not have permission to view this report. Contact your administrator for access.'
          : 'The report could not be loaded. Please try again.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Try again
      </button>
    </div>
  );
}
