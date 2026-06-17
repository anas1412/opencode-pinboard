import { useState, useRef, useEffect, useCallback } from "react";
import { useCreateRepo } from "../hooks/useRepos";
import { X, Folder, CheckCircle, AlertCircle } from "lucide-react";

const supportsNativePicker = "showDirectoryPicker" in window;

interface AddRepoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AddRepoModal({ open, onClose }: AddRepoModalProps) {
  const createRepo = useCreateRepo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [error, setError] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);
  const [showManual, setShowManual] = useState(false);

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

  if (!open) return null;

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
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">{error}</p>
            )}

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
                className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createRepo.isPending ? "Adding..." : "Add repo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
