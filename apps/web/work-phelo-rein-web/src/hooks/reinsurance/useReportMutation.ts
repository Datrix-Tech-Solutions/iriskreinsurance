import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type DefaultError,
} from '@tanstack/react-query';
import { invalidateReinsuranceReports } from '@/lib/reinsurance/reportCache';

/** Opt-in financial mutations only. Failed network mutations never invalidate reports. */
export function useReportMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(options: UseMutationOptions<TData, TError, TVariables, TContext>) {
  const client = useQueryClient();
  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onSuccess: async (data, variables, result, context) => {
      try {
        await options.onSuccess?.(data, variables, result, context);
      } finally {
        await invalidateReinsuranceReports(client);
      }
    },
  });
}
