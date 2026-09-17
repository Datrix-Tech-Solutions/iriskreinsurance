import { useQuery } from '@tanstack/react-query';
import { geocodeForward } from '@/lib/maptiler';

export function useGeocodeSearch(query: string) {
  return useQuery({
    queryKey: ['geocode', 'search', query],
    queryFn: () => geocodeForward(query),
    enabled: query.trim().length > 2,
    staleTime: 5 * 60 * 1000,
  });
}
