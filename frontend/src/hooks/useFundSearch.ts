import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SearchResult } from "@/types";

export function useFundSearch(query: string) {
  return useQuery<SearchResult[]>({
    queryKey: ["global-search", query],
    queryFn: () => api.searchFunds(query),
    enabled: query.length > 0,
  });
}
