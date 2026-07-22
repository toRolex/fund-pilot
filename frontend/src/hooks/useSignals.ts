import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSignals() {
  return useQuery({
    queryKey: ["signals"],
    queryFn: () => api.getSignals(),
  });
}
