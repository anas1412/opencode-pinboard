import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateRepo } from "../hooks/useRepos";
import { request } from "../api/rpc-client";
import { useAppStore } from "../store/app";
import type { GitHubRepoInfo } from "../../shared/types";
import { X, Folder, CheckCircle, AlertCircle, Globe, Search, Lock, Loader2, GitFork } from "lucide-react";

const supportsNativePicker = "showDirectoryPicker" in window;

type Mode = "local" | "clone" | "github";

interface AddRepoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddRepoModal({ open, onClose }: AddRepoModalProps) {
  const qc = useQueryClient();
  const createRepo = useCreateRepo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("local");
  const [name, setName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [error, setError] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Clone mode state
  const [gitUrl, setGitUrl] = useState("");
  const [cloning, setCloning] = useState(false);

  // Browse GitHub state
  const [ghSearch, setGhSearch] = useState("");
  const [cloningRepo, setCloningRepo] = useState<string | null>(null);

  const { ghPhase } = useAppStore();

  const ghReposQuery = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => request("listGitHubRepos"),
    enabled: open && mode === "github" && ghPhase === "authed",
    staleTime: 60_000,
    retry: 1,
  });

  // Filter repos by search
  const filteredRepos = useMemo(() => {
    if (!ghReposQuery.data) return [];
    if (!ghSearch.trim()) return ghReposQuery.data;
    const q = ghSearch.toLowerCase();
    return ghReposQuery.data.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }, [ghReposQuery.data, ghSearch]);

  // Clone a repo from the browse list
  const handleBrowseClone = useCallback(
    async (repo: GitHubRepoInfo) => {
      const repoFull = `${repo.owner}/${repo.name}`;
      setError(null);
      setCloningRepo(repoFull);
      try {
        await request("cloneRepo", {
          gitUrl: repo.sshUrl,
          ghRepoName: repoFull,
        });
        qc.invalidateQueries({ queryKey: ["repos"] });
        onClose();
      } catch (err) {
        setError((err as Error).message || "Failed to clone repo");
        setCloningRepo(null);
      }
    },
    [qc, onClose],
  );

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setName("");
      setLocalPath("");
      setDefaultBranch("main");
      setError(null);
      setSelectedDir(null);
      setIsGitRepo(null);
      setShowManual(false);
      setGitUrl("");
      setGhSearch("");
      setCloningRepo(null);
      setMode("local");
    }
  }, [open]);

  const processGitHead = useCallback(async (text: string) => {
    const isGit = text.startsWith("ref:") || text.trim().length > 0;
    setIsGitRepo(isGit);
    if (isGit) {
      const m = text.match(/ref: refs\/heads\/(.+)/);
      if (m) setDefaultBranch(m[1].trim());
    }
  }, []);

  // Chromium: native folder picker
  const handleNativePicker = useCallback(async () => {
    setPicking(true);
    setError(null);
    try {
      // @ts-ignore — Chromium-only
      const handle = await window.showDirectoryPicker({ mode: "read" });
      setSelectedDir(handle.name);
      setName(handle.name);
      setLocalPath("");

      try {
        const gitHeadHandle = await handle.getFileHandle(".git/HEAD");
        const file = await gitHeadHandle.getFile();
        processGitHead(await file.text());
      } catch {
        setIsGitRepo(false);
      }
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        setError("Could not read the selected folder.");
      }
    }
    setPicking(false);
  }, [processGitHead]);

  // Non-Chromium: webkitdirectory input
  const handleWebkitPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const rootName = files[0].webkitRelativePath.split("/")[0];
    setSelectedDir(rootName);
    setName(rootName);
    setLocalPath("");

    const gitHeadFiles = Array.from(files).filter((f) =>
      f.webkitRelativePath.endsWith("/.git/HEAD"),
    );
    setIsGitRepo(gitHeadFiles.length > 0);

    if (gitHeadFiles.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        const m = (reader.result as string).match(/ref: refs\/heads\/(.+)/);
        if (m) setDefaultBranch(m[1].trim());
      };
      reader.readAsText(gitHeadFiles[0]);
    }

    e.target.value = "";
  }, []);

  // Manual path input
  const handleManualPath = useCallback(() => {
    const path = pathInputRef.current?.value?.trim();
    if (!path) return;
    const parts = path.replace(/\/$/, "").split("/");
    setSelectedDir(parts[parts.length - 1]);
    setName(parts[parts.length - 1]);
    setLocalPath(path);
    setIsGitRepo(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await createRepo.mutateAsync({
        name: name.trim(),
        localPath: localPath.trim() || "",
        defaultBranch: defaultBranch.trim() || "main",
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to add repo");
    }
  };

  const handleClone = async () => {
    if (!gitUrl.trim()) return;
    setCloning(true);
    setError(null);
    try {
      const res = await request("cloneRepo", { gitUrl: gitUrl.trim() });
      qc.invalidateQueries({ queryKey: ["repos"] });
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to clone repo");
    }
    setCloning(false);
  };

  if (!open) return null;

  const tabClass = (tab: Mode) =>
    `flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      mode === tab
        ? "bg-zinc-700 text-white"
        : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="w-[420px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Add repo</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Mode tabs */}
            <div className="flex gap-2 bg-zinc-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setMode("local")}
                className={`${tabClass("local")} flex items-center justify-center gap-1.5 flex-1`}
              >
                <Folder size={12} />
                Local folder
              </button>
              {ghPhase === "authed" && (
                <button
                  type="button"
                  onClick={() => setMode("github")}
                  className={`${tabClass("github")} flex items-center justify-center gap-1.5 flex-1`}
                >
                  <Search size={12} />
                  Browse GitHub
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("clone")}
                className={`${tabClass("clone")} flex items-center justify-center gap-1.5 flex-1`}
              >
                <Globe size={12} />
                Clone URL
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2 break-words">{error}</p>
            )}

            {mode === "github" ? (
              /* ── Browse GitHub ─────────────────────────── */
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    value={ghSearch}
                    onChange={(e) => setGhSearch(e.target.value)}
                    placeholder="Search your repos..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                {/* Loading state */}
                {ghReposQuery.isLoading && (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
                    <Loader2 size={14} className="animate-spin" />
                    Loading repos...
                  </div>
                )}

                {/* Error state */}
                {ghReposQuery.isError && (
                  <div className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
                    {ghReposQuery.error instanceof Error
                      ? ghReposQuery.error.message
                      : "Failed to load repos"}
                  </div>
                )}

                {/* Empty state */}
                {ghReposQuery.isSuccess && filteredRepos.length === 0 && (
                  <p className="text-sm text-zinc-600 italic text-center py-8">
                    {ghSearch.trim()
                      ? "No repos match your search"
                      : "No repos found on your GitHub account"}
                  </p>
                )}

                {/* Repo list */}
                {ghReposQuery.isSuccess && filteredRepos.length > 0 && (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 -mr-1">
                    {filteredRepos.map((repo) => {
                      const isLoading = cloningRepo === `${repo.owner}/${repo.name}`;
                      return (
                        <button
                          key={`${repo.owner}/${repo.name}`}
                          type="button"
                          disabled={isLoading || cloningRepo !== null}
                          onClick={() => handleBrowseClone(repo)}
                          className="w-full text-left border border-zinc-800 hover:border-zinc-600 rounded-lg px-3 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-wait group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate min-w-0">
                              {repo.owner}/<span className="text-zinc-300">{repo.name}</span>
                            </span>
                            {repo.isPrivate && (
                              <Lock size={10} className="shrink-0 text-zinc-500" />
                            )}
                            {repo.isFork && (
                              <GitFork size={10} className="shrink-0 text-zinc-500" />
                            )}
                            {repo.language && (
                              <span className="ml-auto shrink-0 text-[10px] font-medium text-zinc-500 bg-zinc-800/80 rounded px-1.5 py-0.5">
                                {repo.language}
                              </span>
                            )}
                            {isLoading && (
                              <Loader2 size={12} className="shrink-0 text-blue-400 animate-spin" />
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-zinc-500 truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}
                          <p className="text-[10px] text-zinc-600 mt-1">
                            Updated {relativeTime(repo.updatedAt)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : mode === "clone" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Git URL
                  </label>
                  <input
                    type="text"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="git@github.com:user/repo.git"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  />
                  <p className="text-xs text-zinc-500 mt-1.5">
                    Supports SSH (<code className="text-zinc-400">git@github.com:user/repo.git</code>) and HTTPS URLs.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClone}
                    disabled={!gitUrl.trim() || cloning}
                    className="btn-primary flex-1 justify-center"
                  >
                    {cloning ? "Cloning..." : "Clone & add"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Hidden input for webkitdirectory */}
                <input
                  ref={fileInputRef}
                  type="file"
                  // @ts-ignore — non-standard
                  webkitdirectory=""
                  className="hidden"
                  onChange={handleFileInput}
                />

                {showManual ? (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Repo path
                    </label>
                    <input
                      ref={pathInputRef}
                      type="text"
                      placeholder="/home/user/projects/my-project"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleManualPath();
                      }}
                    />
                    <div className="flex gap-3 mt-2">
                      <button
                        type="button"
                        onClick={handleManualPath}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Use this path
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowManual(false)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Pick a folder
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={supportsNativePicker ? handleNativePicker : handleWebkitPicker}
                      disabled={picking}
                      className="w-full flex items-center justify-center gap-3 px-4 py-8 rounded-lg border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Folder size={24} />
                      <span className="text-sm">
                        {picking ? (
                          "Opening..."
                        ) : selectedDir ? (
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-white">{selectedDir}</span>
                            {isGitRepo === true && (
                              <span className="flex items-center gap-1 text-xs text-green-400">
                                <CheckCircle size={12} /> git repo
                              </span>
                            )}
                            {isGitRepo === false && (
                              <span className="flex items-center gap-1 text-xs text-amber-400">
                                <AlertCircle size={12} /> not a git repo
                              </span>
                            )}
                          </span>
                        ) : (
                          "Choose a folder..."
                        )}
                      </span>
                    </button>
                    {!selectedDir && (
                      <button
                        type="button"
                        onClick={() => setShowManual(true)}
                        className="mt-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Or type a path
                      </button>
                    )}
                  </div>
                )}

                {selectedDir && (
                  <div className="space-y-1 text-xs text-zinc-500 bg-zinc-800/50 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 w-16">Name:</span>
                      <span className="text-zinc-300 font-medium">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 w-16">Branch:</span>
                      <span className="text-zinc-300 font-mono">{defaultBranch}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedDir || createRepo.isPending}
                    className="btn-primary flex-1 justify-center"
                  >
                    {createRepo.isPending ? "Adding..." : "Add repo"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
}

/** Format a GitHub ISO date string as a relative time ("3d ago", "2w ago", etc.) */
function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay < 1) return "Today";
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}
