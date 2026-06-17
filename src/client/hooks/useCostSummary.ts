import { useQuery } from "@tanstack/react-query";
import { fetchCostSummary } from "../api/costs";

export function useCostSummary() {
  return useQuery({
    queryKey: ["costs", "summary"],
    queryFn: fetchCostSummary,
    refetchInterval: 60_000, // refresh every minute
  });
}
