import { useState, useMemo } from "react";
import { useTicket, useUpdateTicket, useDeleteTicket } from "../hooks/useTickets";
import { useRepos } from "../hooks/useRepos";
import { useAppStore } from "../store/app";
import type { TicketStatus, TicketPriority, TicketCategory } from "../../shared/types";
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from "../../shared/types";
import { Clock, GitBranch, DollarSign, FileCode, Pencil, X, Trash2, Check } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  needs_review: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  changes_requested: "bg-red-500/20 text-red-400 border-red-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

interface TicketDetailProps {
  ticketId: string;
  onStartSession: () => void;
  sessionActive: boolean;
}

export default function TicketDetail({ ticketId, onStartSession, sessionActive }: TicketDetailProps) {
  const { data: ticket, isLoading, isError } = useTicket(ticketId);
  const { data: repos } = useRepos();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const { setSelectedTicketId } = useAppStore();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TicketStatus>("open");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [category, setCategory] = useState<TicketCategory>("feature");
  const [tagsStr, setTagsStr] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const repoName = useMemo(
    () => repos?.find((r) => r.id === ticket?.repoId)?.name,
    [repos, ticket?.repoId],
  );

  // Enter edit mode — populate from current ticket
  function startEditing() {
    if (!ticket) return;
    setTitle(ticket.title);
    setDescription(ticket.description);
    setNotes(ticket.notes);
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setCategory(ticket.category);
    setTagsStr(ticket.tags.join(", "));
    setEditing(true);
  }

  async function saveEdits() {
    if (!ticket || saving) return;
    setSaving(true);
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        input: {
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          notes: notes.trim() !== ticket.notes ? notes.trim() : undefined,
          status,
          priority,
          category,
          tags: tagsStr
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      setEditing(false);
    } catch {
      // error handled by react-query
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!ticket) return;
    await deleteTicket.mutateAsync(ticket.id);
    setSelectedTicketId(null);
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-6 w-3/4 bg-zinc-800 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-zinc-800 rounded animate-pulse" />
        <div className="h-24 bg-zinc-800 rounded animate-pulse" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="p-4 text-center text-zinc-500">
        <p className="text-sm text-red-400">Could not load ticket.</p>
      </div>
    );
  }

  // ── READ MODE ──
  if (!editing) {
    return (
      <div className="p-4 space-y-4 overflow-auto h-full">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[ticket.status] || ""}`}
            >
              {ticket.status.replace("_", " ")}
            </span>
            <span className="text-xs text-zinc-500 uppercase">{ticket.category}</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="text-xs text-zinc-500 capitalize">{ticket.priority}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!sessionActive && (
              <button
                onClick={startEditing}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Edit ticket"
              >
                <Pencil size={14} />
              </button>
            )}
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete ticket"
              >
                <Trash2 size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  title="Confirm delete"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-base font-semibold text-white leading-snug">{ticket.title}</h2>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-400">
          {repoName && (
            <span className="flex items-center gap-1">
              <FileCode size={12} />
              {repoName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <GitBranch size={12} />
            {ticket.branch}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign size={12} />
            {ticket.totalCostUsd > 0 ? `$${ticket.totalCostUsd.toFixed(2)}` : "No cost"}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {new Date(ticket.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Description */}
        {ticket.description && (
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Description</p>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>
        )}

        {/* Notes */}
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Notes</p>
        {ticket.notes ? (
          <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">{ticket.notes}</p>
        ) : (
          <p className="text-xs text-zinc-600 italic">No notes</p>
        )}

        {/* Files changed */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Files changed</p>
          {ticket.filesChanged.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No files changed yet</p>
          ) : (
            <ul className="space-y-1">
              {ticket.filesChanged.map((file) => (
                <li key={file} className="text-sm text-zinc-400 font-mono">{file}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Sessions */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            Sessions ({ticket.sessionIds.length})
          </p>
          {ticket.sessionIds.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No sessions yet</p>
          ) : (
            <div className="space-y-1">
              {ticket.sessionIds.map((sid) => (
                <div key={sid} className="text-xs text-zinc-500 font-mono">{sid.slice(0, 8)}...</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── EDIT MODE ──
  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Edit ticket</p>
        <div className="flex items-center gap-1">
          <button
            onClick={saveEdits}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
          >
            <Check size={12} />
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
      </div>

      {/* Status */}
      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus)}
          className="w-full bg-zinc-800/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {/* Row: Priority + Category */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            className="w-full bg-zinc-800/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className="w-full bg-zinc-800/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full bg-zinc-800/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">
          Tags <span className="font-normal lowercase text-zinc-600">(comma separated)</span>
        </label>
        <input
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          placeholder="ui, performance, urgent"
          className="w-full bg-zinc-800/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-zinc-800/50 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 resize-none"
        />
      </div>

      {/* Delete */}
      {!deleteConfirm ? (
        <button
          onClick={() => setDeleteConfirm(true)}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          <Trash2 size={12} /> Delete ticket
        </button>
      ) : (
        <div className="flex items-center gap-2 pt-2 border-t border-red-900/50">
          <p className="text-xs text-red-400">Delete this ticket?</p>
          <button onClick={handleDelete} className="px-2 py-1 rounded text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors">
            Delete
          </button>
          <button onClick={() => setDeleteConfirm(false)} className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
