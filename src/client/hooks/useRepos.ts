import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRepos, createRepo, updateRepo, deleteRepo } from "../api/repos";
import type { RepoCreateInput, RepoUpdateInput } from "../../shared/types";

export function useRepos() {
  return useQuery({
    queryKey: ["repos"],
    queryFn: fetchRepos,
  });
}

export function useCreateRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RepoCreateInput) => createRepo(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

export function useUpdateRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RepoUpdateInput }) =>
      updateRepo(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRepo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}
