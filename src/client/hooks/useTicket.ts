import { useQuery } from "@tanstack/react-query";
import { fetchTicket } from "../api/tickets";
import type { Ticket } from "../../shared/types";

export function useTicket(id: string) {
  return useQuery<Ticket>({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id),
    enabled: !!id,
    staleTime: 5_000,
  });
}
