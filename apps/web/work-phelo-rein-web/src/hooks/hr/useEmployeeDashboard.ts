import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { UpcomingBirthday } from '@/types/hr';

export function useEmployeeDashboard() {
  return useQuery({
    queryKey: ['employee-dashboard'],
    queryFn: () => api.get('/hr/dashboard/me').then((r) => r.data),
  });
}

export function useDepartmentDistribution() {
  return useQuery({
    queryKey: ['dashboard-dept-distribution'],
    queryFn: () => api.get('/hr/dashboard/department-distribution').then((r) => r.data),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: () => api.get('/hr/dashboard/recent-activity').then((r) => r.data),
  });
}

export function useUpcomingBirthdays() {
  return useQuery({
    queryKey: ['dashboard-birthdays'],
    queryFn: () =>
      api
        .get<{ birthdays: UpcomingBirthday[] }>('/hr/dashboard/upcoming-birthdays')
        .then((r) => r.data),
  });
}

export function useRecentlyAdded() {
  return useQuery({
    queryKey: ['dashboard-recently-added'],
    queryFn: () => api.get('/hr/dashboard/recently-added').then((r) => r.data),
  });
}
