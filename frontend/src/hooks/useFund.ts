import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useFundDetail(code: string) {
  return useQuery({
    queryKey: ["fund", code],
    queryFn: () => api.getFundDetail(code),
    enabled: !!code,
  });
}

export function useFundNav(code: string) {
  return useQuery({
    queryKey: ["fund-nav", code],
    queryFn: () => api.getFundNav(code),
    enabled: !!code,
  });
}

export function useFundSignals(code: string) {
  return useQuery({
    queryKey: ["fund-signals", code],
    queryFn: () => api.getFundSignals(code),
    enabled: !!code,
  });
}

export function useFundStrategies(code: string) {
  return useQuery({
    queryKey: ["fund-strategies", code],
    queryFn: () => api.getFundStrategies(code),
    enabled: !!code,
  });
}

export function useToggleFundStrategy(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.toggleFundStrategy(code, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fund-strategies", code] });
    },
  });
}
