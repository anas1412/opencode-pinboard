import { useQuery } from "@tanstack/react-query";
import { fetchRecentSessions, type RecentSessionsParams } from "../api/sessions";

export function useRecentSessions(params?: RecentSessionsParams) {
  return useQuery({
    queryKey: ["sessions", "recent", params],
    queryFn: () => fetchRecentSessions(params),
    refetchInterval: 30_000,
  });
}
