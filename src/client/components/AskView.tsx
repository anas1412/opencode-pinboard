import { useEffect, useState, useCallback, useRef } from "react"
import { Plus, Trash2, Pencil, Check, X, Sparkles, MessageSquare, Loader2, ArrowRight } from "lucide-react"
import { createAskChat, listAskChats, renameAskChat, deleteAskChat } from "../api/ask"
import type { AskChat } from "../api/ask"

export function AskView() {
  const [conversations, setConversations] = useState<AskChat[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sharedPort, setSharedPort] = useState<number | null>(null)
  const [sharedCwd, setSharedCwd] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await listAskChats()
      setConversations(list)
      setError(null)
    } catch {
      console.error("Failed to list ask chats")
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const handleNew = useCallback(async () => {
    setCreating(true)
    try {
      const result = await createAskChat()
      setSharedPort(result.opencodePort)
      setSharedCwd(result.cwd)
      setActiveId(result.id)
      setIframeLoading(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat")
    } finally {
      setCreating(false)
    }
  }, [refresh])

  const handleSelect = useCallback(async (chat: AskChat) => {
    setActiveId(chat.id)
    setIframeLoading(true)
    if (sharedPort === null || sharedCwd === null) {
      try {
        const result = await createAskChat()
        setSharedPort(result.opencodePort)
        setSharedCwd(result.cwd)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect")
        setIframeLoading(false)
      }
    }
  }, [sharedPort, sharedCwd])

  const handleRenameStart = useCallback((chat: AskChat) => {
    setRenamingId(chat.id)
    setRenameValue(chat.name)
  }, [])

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null)
      return
    }
    try {
      await renameAskChat(renamingId, renameValue.trim())
      setRenamingId(null)
      await refresh()
    } catch {
      console.error("Failed to rename")
    }
  }, [renamingId, renameValue, refresh])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteAskChat(id)
      if (activeId === id) {
        setActiveId(null)
        setIframeLoading(false)
      }
      await refresh()
    } catch {
      console.error("Failed to delete")
    }
  }, [activeId, refresh])

  const handleIframeLoad = useCallback(() => {
    setIframeLoading(false)
  }, [])

  // ── Build iframe URL ──────────────────────────────────────────────
  const activeChat = conversations.find((c) => c.id === activeId)
  const iframeUrl =
    activeChat && sharedPort && sharedCwd
      ? `http://127.0.0.1:${sharedPort}/${encodeDirSlug(sharedCwd)}/session/${activeChat.opencodeSessionId}`
      : null

  return (
    <div className="flex h-full">
      {/* ── LEFT: conversation list ── */}
      <div className="w-[480px] min-w-[480px] border-r border-zinc-800 flex flex-col bg-zinc-950">
        {/* Header with label + new button */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Conversations
          </p>
          <button
            onClick={handleNew}
            disabled={creating}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="New conversation"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 bg-red-950/30 border-b border-red-900/30">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="underline hover:text-red-300 shrink-0">Dismiss</button>
          </div>
        )}

        {/* Conversation list */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-xs text-zinc-600">
            <Loader2 size={12} className="animate-spin" />
            Loading...
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-600 italic px-4 text-center">
            No conversations yet
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {conversations.map((chat) => {
              const isActive = activeId === chat.id
              const isPending = isActive && iframeLoading
              return (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "text-zinc-200 bg-zinc-800/60"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                  onClick={() => handleSelect(chat)}
                >
                  {isPending ? (
                    <Loader2 size={10} className="shrink-0 animate-spin" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-amber-300" : "bg-amber-400"}`} />
                  )}
                  {renamingId === chat.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleRenameConfirm() }}
                      className="flex items-center gap-0.5 flex-1 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameConfirm}
                        className="flex-1 min-w-0 bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-100 outline-none"
                      />
                      <button type="submit" className="p-0.5 text-zinc-400 hover:text-zinc-200"><Check size={10} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingId(null) }}
                        className="p-0.5 text-zinc-500 hover:text-zinc-300"
                      ><X size={10} /></button>
                    </form>
                  ) : (
                    <span className="flex-1 min-w-0 truncate">{chat.name}</span>
                  )}
                  <ArrowRight
                    size={12}
                    className={`shrink-0 ${isActive ? "text-zinc-500" : "text-zinc-600"} opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenameStart(chat) }}
                      className="p-0.5 text-zinc-500 hover:text-zinc-300"
                      title="Rename"
                    ><Pencil size={10} /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(chat.id) }}
                      className="p-0.5 text-zinc-500 hover:text-red-400"
                      title="Delete"
                    ><Trash2 size={10} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT: opencode panel ── */}
      <div className="flex-1 flex flex-col bg-zinc-950">
        {iframeUrl ? (
          <div className="flex-1 min-h-0 relative">
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 size={14} className="animate-spin" />
                  Loading...
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={activeId}
              src={iframeUrl}
              onLoad={handleIframeLoad}
              className="w-full h-full border-0"
              title="Ask Pinboard Chat"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Sparkles size={24} className="mx-auto text-amber-500/40" />
              <p className="text-xs text-zinc-600">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

function encodeDirSlug(dir: string): string {
  const bytes = new TextEncoder().encode(dir)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
