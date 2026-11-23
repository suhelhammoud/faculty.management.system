import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataKey, request } from '../student-affairs/api';

const key = [...dataKey, 'department'];

export function useDepartmentRead<T>(path = '', enabled = true, refetchOnWindowFocus = true) {
  return useQuery({
    queryKey: [...key, path],
    queryFn: ({ signal }) => request<T>(`department${path}`, 'GET', undefined, signal),
    enabled,
    refetchOnWindowFocus,
  });
}

export function useDepartmentWrite<T = void>() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: key,
    mutationFn: ({
      path = '',
      method = 'POST',
      body,
    }: {
      path?: string;
      method?: 'POST' | 'PATCH';
      body?: object;
    }) => request<T>(`department${path}`, method, body),
    onSuccess: () => client.invalidateQueries({ queryKey: dataKey }),
  });
}
