import { apiFetch } from "./client";
import type { JournalResponse } from "../../shared/types";

export function fetchJournal(offset: number = 0, limit: number = 7): Promise<JournalResponse> {
  return apiFetch(`/api/journal?offset=${offset}&limit=${limit}`);
}
