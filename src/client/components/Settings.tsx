import { useState, useMemo } from "react";
import { useRepos, useUpdateRepo } from "../hooks/useRepos";
import { Settings2, Plus, X, Save } from "lucide-react";

interface EnvEntry {
  key: string;
  value: string;
}

function RepoSettingsCard({ repo }: { repo: { id: string; name: string; envVars: Record<string, string> } }) {
  const updateRepo = useUpdateRepo();
  const [entries, setEntries] = useState<EnvEntry[]>(() => Object.entries(repo.envVars).map(([k, v]) => ({ key: k, value: v })));
  const [dirty, setDirty] = useState(false);

  const updateEntry = (i: number, field: "key" | "value", val: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      return next;
    });
    setDirty(true);
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { key: "", value: "" }]);
    setDirty(true);
  };

  const removeEntry = (i: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const handleSave = () => {
    const envVars: Record<string, string> = {};
    for (const { key, value } of entries) {
      if (key.trim()) envVars[key.trim()] = value;
    }
    updateRepo.mutate({ id: repo.id, input: { envVars } });
    setDirty(false);
  };

  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-white mb-3">{repo.name}</h3>

      {entries.length === 0 && (
        <p className="text-xs text-zinc-600 italic mb-3">No environment variables configured</p>
      )}

      <div className="space-y-2 mb-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              placeholder="KEY"
              value={entry.key}
              onChange={(e) => updateEntry(i, "key", e.target.value)}
            />
            <input
              className="flex-[2] bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono"
              placeholder="value"
              value={entry.value}
              onChange={(e) => updateEntry(i, "value", e.target.value)}
            />
            <button
              onClick={() => removeEntry(i)}
              className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={addEntry}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <Plus size={12} />
          Add variable
        </button>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={updateRepo.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          >
            <Save size={12} />
            {updateRepo.isPending ? "Saving..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: repos, isLoading } = useRepos();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 size={16} className="text-zinc-400" />
          <h2 className="text-lg font-semibold text-white">Settings</h2>
        </div>
        <p className="text-sm text-zinc-500">
          Manage repo configuration and environment variables.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-600">Loading repos…</p>
      ) : repos && repos.length > 0 ? (
        <div className="space-y-4">
          {repos.map((repo) => (
            <RepoSettingsCard key={repo.id} repo={repo} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600 italic">
          No repos added yet. Add one from the sidebar.
        </p>
      )}
    </div>
  );
}
