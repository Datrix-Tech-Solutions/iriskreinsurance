import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreatePublicHolidayDto, PublicHoliday, UpdatePublicHolidayDto } from '@/types/hr';

export function usePublicHolidays() {
  return useQuery({
    queryKey: ['public-holidays'],
    queryFn: () => api.get<PublicHoliday[]>('/hr/leave/public-holidays').then((r) => r.data),
  });
}

export function useCreatePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePublicHolidayDto) =>
      api.post<PublicHoliday>('/hr/leave/public-holidays', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-holidays'] }),
  });
}

export function useUpdatePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: UpdatePublicHolidayDto & { id: string }) =>
      api.patch<PublicHoliday>(`/hr/leave/public-holidays/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-holidays'] }),
  });
}

export function useDeletePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/leave/public-holidays/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-holidays'] }),
  });
}
