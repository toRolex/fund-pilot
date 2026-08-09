import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useFundDetail(code: string) {
  return useQuery({
    queryKey: ["fund-detail", code],
    queryFn: async () => {
      // 并行获取：基金信息 + 净值序列 + 持久化信号 + 策略状态，不依赖现算合并端点
      const [detail, nav, signals, strategies] = await Promise.all([
        api.getFundDetail(code),
        api.getFundNav(code),
        api.getSignals(code, { all_history: true }),
        api.getFundStrategies(code),
      ]);
      return { detail, nav, signals, strategies };
    },
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
      queryClient.invalidateQueries({ queryKey: ["fund-detail", code] });
    },
  });
}
