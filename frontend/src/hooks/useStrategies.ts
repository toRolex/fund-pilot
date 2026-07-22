import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: () => api.getStrategies(),
  });
}

export function useStrategyLogs() {
  return useQuery({
    queryKey: ["strategy-logs"],
    queryFn: () => api.getStrategyLogs(),
    refetchInterval: 10_000,
  });
}

export function useToggleStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.toggleStrategy(name, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategy-logs"] });
    },
  });
}
