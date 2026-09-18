import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { UpdateEmployeePayload } from '@/types/hr';

interface Options {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

export function useUpdateEmployee(id: string, options?: Options) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateEmployeePayload) => api.patch(`/hr/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees-all'] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
