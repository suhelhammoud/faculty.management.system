import { useQuery } from '@tanstack/react-query';
import { hrApi } from './api';
import type { Kind, Reference } from './types';
export function useReferences(kind: Kind) {
  return useQuery({
    queryKey: ['hr', 'references', kind],
    queryFn: ({ signal }) => hrApi<Reference[]>(kind, 'GET', undefined, signal),
  });
}
