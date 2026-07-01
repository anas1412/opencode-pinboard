import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, GitBranch } from "lucide-react";
import GhSettings from "./GhSettings";

export default function GhSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back button + header */}
        <div>
          <button
            onClick={() => navigate({ to: "/settings" })}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Back to Settings
          </button>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={16} className="text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">GitHub Settings</h2>
          </div>
          <p className="text-sm text-zinc-500">
            Connect your GitHub account to create PRs and manage repositories.
          </p>
        </div>

        <GhSettings />
      </div>
    </div>
  );
}
