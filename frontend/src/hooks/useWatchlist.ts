import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SignalType } from "@/types";

export interface WatchlistItem {
  code: string;
  name: string;
  daily_change: number;
  signal_type: SignalType;
  strategy_name: string;
  confidence: number;
}

export function useWatchlist() {
  return useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    queryFn: () => api.getFunds() as Promise<WatchlistItem[]>,
  });
}

export function useAddFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.addFund(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

export function useRemoveFund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.removeFund(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}
