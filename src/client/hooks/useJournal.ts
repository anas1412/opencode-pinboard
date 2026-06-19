import { useQuery } from "@tanstack/react-query";
import { fetchJournal } from "../api/journal";

export function useJournal(offset: number = 0, limit: number = 7) {
  return useQuery({
    queryKey: ["journal", offset, limit],
    queryFn: () => fetchJournal(offset, limit),
    placeholderData: (prev) => prev,
  });
}
