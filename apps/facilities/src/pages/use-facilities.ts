import { useQuery } from '@tanstack/react-query';
import { facilityApi } from '../lib/api';
import type { FacilitiesData } from '../lib/types';

export function useFacilities() {
  return useQuery({
    queryKey: ['facilities', 'data'],
    queryFn: ({ signal }) => facilityApi<FacilitiesData>('', 'GET', undefined, signal),
  });
}
