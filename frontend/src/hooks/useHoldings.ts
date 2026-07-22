import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { HoldingResponse } from "@/types";

export function useHoldings() {
  return useQuery<HoldingResponse[]>({
    queryKey: ["holdings"],
    queryFn: () => api.getHoldings(),
  });
}
