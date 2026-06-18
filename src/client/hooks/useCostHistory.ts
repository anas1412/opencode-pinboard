import { useQuery } from "@tanstack/react-query";
import { fetchCostHistory } from "../api/costs";

export function useCostHistory() {
  return useQuery({
    queryKey: ["costs", "history"],
    queryFn: fetchCostHistory,
    staleTime: 120_000,
  });
}
