import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useFundDetail(code: string) {
  return useQuery({
    queryKey: ["fund-detail-merged", code],
    queryFn: () => api.getFundDetailMerged(code),
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
      queryClient.invalidateQueries({ queryKey: ["fund-detail-merged", code] });
    },
  });
}
