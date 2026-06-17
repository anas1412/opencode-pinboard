# OpenDev — Product Requirements Document

**Version:** 2.0  
**Status:** Active  
**Last updated:** June 2026  
**Scope:** Free tier — single developer, local machine

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [Core Loop](#3-core-loop)
4. [Architecture](#4-architecture)
5. [Data Model](#5-data-model)
6. [UI & UX Specification](#6-ui--ux-specification)
7. [opencode Integration](#7-opencode-integration)
8. [Diff & Review Flow](#8-diff--review-flow)
9. [Cost Tracking](#9-cost-tracking)
10. [Notifications](#10-notifications)
11. [Build Phases](#11-build-phases)
12. [Tech Stack](#12-tech-stack)
13. [Open Questions](#13-open-questions)
14. [Testing Strategy](#14-testing-strategy)
15. [CI/CD](#15-cicd)

---

## 1. Product Overview

OpenDev is a local browser-based workspace where every unit of work is a **ticket** and every ticket spawns a **live opencode session** directly in the browser. The developer opens a ticket, a terminal panel appears running opencode already scoped to the correct repo and branch, the agent works, the developer reviews the diff, and closes the ticket. No new terminal window, no context switching, no Docker.

The entire loop — task definition, agent execution, diff review, and commit — happens in one browser tab at `localhost:3000`.

### What makes it different

OpenDev treats the **ticket as the primitive**. Every opencode session is permanently linked to the ticket that spawned it: the task description, session transcript, token cost, files changed, and git diff are all stored together. The developer always knows what was asked, what the agent did, what it cost, and exactly what changed.

### Scope of this document

This document covers **OpenDev Free** — a single-developer, local-only product. No accounts, no cloud, no teams. It runs as a local server (`bunx opendev` or an installable binary) and is accessed via the browser.

---

## 2. Goals & Success Metrics

### Primary goal

Get from "I have a task" to "code is committed, diff is reviewed" in the fewest possible steps, with opencode doing the work in the browser.

### Success metrics

| Metric | Target |
|--------|--------|
| Time from ticket open to opencode running in browser | < 3 seconds |
| Time from session end to diff visible | < 1 second |
| opencode version check on startup | Always runs latest |
| Setup steps for a new developer | `bunx opendev` → browser opens → done |

---

## 3. Core Loop

```
Create ticket
    │  title, description, repo, category
    ▼
Ticket opens → split view
    │
    ├── Left panel: ticket spec + live notes
    └── Right panel: browser terminal running opencode
              │
              │  opencode starts with:
              │    cwd = repo path
              │    branch = feat/ticket-{slug} (auto-created)
              │    initial prompt = ticket description
              │
              ▼
         Agent works
              │
              ├── Developer watches live in terminal
              ├── Developer can type into terminal at any time
              │
              ▼
         opencode exits
              │
              ▼
         "Session complete" banner
              │
              ▼
         Diff view (auto, same panel)
              │   all changed files, side-by-side
              │   accept all  /  reject file  /  request revision
              │
              ▼ (accepted)
         Commit created on feat/ticket-{slug}
         Session + transcript saved
         Cost recorded
         Ticket → Resolved
```

Every step is reversible. "Request revision" reopens the terminal with a follow-up prompt pre-filled. The loop repeats until the developer is satisfied.

---

## 4. Architecture

### 4.1 Overview

```
Browser (React + Vite)                localhost:3000
    │
    ├── REST   GET/POST /api/*         tickets, sessions, repos, cost
    ├── SSE    /events                 session.*, ticket.*, cost.*
    └── WebSocket /ws/terminal/{id}   bidirectional PTY stream

OpenDev Server (Bun + Fastify)        localhost:3000
    │
    ├── REST API          Drizzle ORM → SQLite (~/.opendev/db.sqlite)
    ├── SSE broadcast     EventEmitter → all connected browser clients
    ├── PTY manager       node-pty spawns opencode per session
    │                     stdout/stderr → WS → browser xterm.js
    │                     browser keystrokes → WS → PTY stdin
    ├── Transcript tee    PTY stdout captured → Session.transcript
    ├── Git operations    simple-git: branch, diff, commit
    └── opencode version  checks npm registry on startup, auto-upgrades
```

### 4.2 Why node-pty here (not ttyd)

OpenDev runs as a local Bun server. node-pty spawns opencode as a child process with a PTY, streams its output over WebSocket to xterm.js in the browser, and captures everything for the transcript simultaneously. This is a single Bun process — no separate binary to install or manage. The developer installs OpenDev, and that's the only install they do. opencode itself is managed by OpenDev (see §7).

### 4.3 Transport

| Channel | Protocol | Purpose |
|---------|----------|---------|
| Data API | REST | CRUD for tickets, sessions, repos |
| Push events | SSE | Session status, cost updates, real-time file list |
| Terminal I/O | WebSocket | PTY stream (bidirectional, per session) |
| Diff payload | REST | Fetched on session end via `git diff` |

### 4.4 Storage

Two storage layers:

**SQLite** at `~/.opendev/db.sqlite`. Managed by Drizzle ORM with Drizzle Kit for migrations. Holds all structured operational data: tickets, sessions, cost records, repo metadata. Transcripts stored as JSON text. A single file the developer can back up, inspect, or delete. No external database process.

**Filesystem** — project-specific content lives as `.md` files in each repo's `.opendev/` directory (see §5.5). Global templates live in `~/.opendev/templates/` (see §6.4).

### 4.5 Distribution

Shipped as an npm package: `bun install -g opendev` or `bunx opendev`. Running `opendev` starts the server and opens `localhost:3000` in the default browser. All state lives in `~/.opendev/`.

### 4.6 Logging

Structured JSON logs written to `~/.opendev/logs/opendev-{YYYY-MM-DD}.log`. One file per day, never deleted by OpenDev — the developer manages disk space.

| Level | Purpose | Events |
|-------|---------|--------|
| `debug` | Troubleshooting | Every API request (method, path, duration), SSE events emitted, WebSocket messages (truncated), file watcher events |
| `info` | Normal operation | Server start/stop, session start/end, ticket create/resolve, opencode version check, git branch created, commit created |
| `warn` | Recoverable issues | Cost parse failure, `context.md` not found, chokidar error, opencode upgrade failure, session non-zero exit |
| `error` | Failures | PTY spawn failure, git operation failure (diff, branch, commit), DB connection failure, WebSocket error, unhandled exception |

Default level: `info`. Configurable via `OPENDEV_LOG_LEVEL` env var.

Log line format:
```
{"ts":"2026-06-17T14:30:00.123Z","level":"info","msg":"session started","sessionId":"abc","ticketId":"xyz","durationMs":42}
```

Settings view includes a "View logs" button that opens the log directory in the file manager.

### 4.7 Security

Local-only architecture reduces the attack surface. The following rules constrain what remains:

| Rule | Applies to | Implementation |
|------|-----------|----------------|
| **No raw HTML in Markdown** | Ticket descriptions, notes, templates | Always pass rendered Markdown through DOMPurify before inserting into DOM |
| **Escape git output** | Filenames, diffs, branch names from remote repos | `escapeHtml()` on all git output before rendering in React |
| **Input validation** | All REST/WS endpoints | Validate with Zod schemas before reaching business logic |
| **Path confinement** | Repo `localPath`, branch names, file paths | Reject `..` traversal. Constrain branch names to `[a-zA-Z0-9/_\-]` |
| **Parameterized queries** | All database access | Drizzle ORM exclusively — no raw SQL concatenation |
| **No eval** | Everywhere | Never use `eval()`, `new Function()`, or dynamic `require()` on user-supplied strings |
| **CSP header** | HTML page | `script-src: 'self'` — no inline scripts except Vite dev mode hot reload |

xterm.js natively sanitizes terminal escape sequences — OpenDev relies on this.

### 4.8 Backend Error Handling

Every operation has a defined error response. The server never crashes — it catches and returns structured errors.

| Error case | HTTP / WS | Log level | UI behavior |
|---|---|---|---|
| `opencode not in PATH` | 503 | error | Onboarding screen with install instructions + "Check again" button |
| `Repo path not found` | 404 | warn | Inline error in Settings: "Path does not exist" |
| `Git branch creation fails` | 500 | error | Session fails to start. Toast: "Could not create branch. Check repo permissions." |
| `PTY spawn fails` | WS close | error | Terminal panel shows error message with retry button |
| `Session non-zero exit` | N/A (SSE event) | warn | Banner: "opencode exited with code {code}" instead of session complete |
| `Git diff fails` | 500 | error | Diff view shows "Could not compute diff." with option to view raw git output |
| `Cost parse failure` | N/A (silent) | warn | Session records without cost data. Badge shows "—" |
| `WebSocket disconnect` | N/A | debug | Terminal panel shows "Connection lost. [Reconnect]" |
| `SSE connection lost` | N/A | debug | Auto-reconnect with exponential backoff, toast on persistent failure |
| `opencode upgrade fails` | N/A | warn | Toast: "opencode upgrade failed. [Retry] [Ignore]" |
| `context.md not found` | N/A (silent) | debug | Session proceeds with ticket description only |

All API error responses follow a uniform shape:
```json
{"error": "ERROR_CODE", "message": "Human-readable description", "details": {}}
```

---

## 5. Data Model

### 5.1 Ticket

```typescript
interface Ticket {
  id:               string          // UUID
  title:            string
  description:      string          // Markdown — becomes opencode's initial prompt
  status:           TicketStatus
  priority:         "low" | "medium" | "high" | "critical"
  category:         "feature" | "bug" | "refactor" | "chore" | "docs"

  // Repo & branch
  repoId:           string          // FK → Repo
  branch:           string          // auto-gen: feat/{slug}
  baseBranch:       string          // from repo.defaultBranch

  // Sessions
  sessionIds:       string[]        // all sessions, ordered
  activeSessionId:  string | null

  // Output
  filesChanged:     string[]        // updated after each session
  totalCostUsd:     number          // sum across all sessions
  totalTokens:      number

  // Metadata
  tags:             string[]
  notes:            string          // Markdown, editable any time
  createdAt:        Date
  updatedAt:        Date
  resolvedAt:       Date | null
}

type TicketStatus =
  | "open"               // created, no session yet
  | "in_progress"        // session active
  | "needs_review"       // session ended, diff not reviewed
  | "changes_requested"  // revision requested, new session pending
  | "resolved"           // diff accepted, committed
  | "closed"             // archived
```

### 5.2 Session

```typescript
interface Session {
  id:               string
  ticketId:         string

  // opencode invocation
  opencodeVersion:  string          // recorded at spawn time
  model:            string          // detected from opencode output
  cwd:              string          // repo path
  branch:           string
  initialPrompt:    string          // ticket description (+ prior revision note)

  // Transcript — full PTY output, timestamped
  transcript:       TranscriptEntry[]

  // Output
  diff:             FileDiff[]      // computed on exit
  filesChanged:     string[]
  exitCode:         number | null
  exitReason:       "natural" | "user_stopped" | "error"

  // Cost — parsed from opencode's output
  promptTokens:     number
  completionTokens: number
  totalTokens:      number
  costUsd:          number

  // Timing
  createdAt:        Date
  endedAt:          Date | null
  durationMs:       number | null

  // Review
  approved:         boolean | null
  revisionNote:     string | null   // developer's note when requesting revision
}

interface TranscriptEntry {
  ts:     number    // ms since session start
  type:   "output" | "input" | "system"
  data:   string
}

interface FileDiff {
  path:       string
  status:     "added" | "modified" | "deleted" | "renamed"
  oldPath:    string | null
  additions:  number
  deletions:  number
  patch:      string    // unified diff
  accepted:   boolean   // default true, toggled in review
}
```

### 5.3 Repo

```typescript
interface Repo {
  id:             string
  name:           string
  localPath:      string          // absolute path on disk, .opendev/ derived from here
  defaultBranch:  string
  envVars:        Record<string, string>  // injected into opencode process

  createdAt:      Date
  lastUsedAt:     Date | null
}
```

### 5.4 CostRecord

```typescript
interface CostRecord {
  id:               string
  sessionId:        string
  ticketId:         string
  repoId:           string
  opencodeVersion:  string
  model:            string
  promptTokens:     number
  completionTokens: number
  costUsd:          number
  recordedAt:       Date
}
```

### 5.5 Filesystem Data — per-repo `.md` files

Project-specific content lives inside each registered repo's `.opendev/` directory. These files are in the repo — versioned, cloned, committed alongside code.

```
~/projects/my-api/                     # registered repo
  ├── src/
  └── .opendev/
      ├── context.md                   ← injected into every opencode session prompt
      └── notes.md                     ← developer scratch notes, OpenDev ignores it
```

| File | Purpose | Read by OpenDev? |
|------|---------|------------------|
| `context.md` | Project facts: tech stack, structure, conventions, setup | Yes — prepended to every session prompt |
| `notes.md` | Developer scratch notes, free-form | No |

OpenDev never writes to these files. They are authoring surfaces for the developer, edited in their own editor. If a file doesn't exist, OpenDev proceeds normally.

**Global templates** live in `~/.opendev/templates/` (see §6.4).

---

## 6. UI & UX Specification

### 6.1 Shell layout

Single-page app. Persistent left sidebar (220px), fluid main content area. No top bar.

```
┌──────────────────────────────────────────────────────────────────┐
│  Sidebar (220px)          │  Main area (fluid)                   │
│                           │                                      │
│  OpenDev                  │  [active view]                       │
│                           │                                      │
│  ── Views ──              │                                      │
│  ◉ List                   │                                      │
│  ○ Kanban                 │                                      │
│                           │                                      │
│  ── Repos ──              │                                      │
│    my-api                 │                                      │
│    frontend               │                                      │
│                           │                                      │
│  ── This week ──          │                                      │
│    $4.82                  │                                      │
│    14,320 tokens          │                                      │
│                           │                                      │
│  [+ New ticket]           │                                      │
│  [Settings]               │                                      │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 List view

Default view. A table of all tickets with:

| Column | Notes |
|--------|-------|
| Status | Colored badge |
| Title | Clickable, opens split view |
| Repo | Repo name |
| Category | feature / bug / refactor etc. |
| Cost | Total USD across sessions, live during active session |
| Updated | Relative time |

Sortable by any column. Filterable by status, repo, category, tag. Full-text search across title and description. Keyboard-navigable: arrow keys move selection, Enter opens.

### 6.3 Kanban view

Five columns: Open · In Progress · Needs Review · Changes Requested · Resolved.

Cards show: status dot, title, repo name, cost badge. Draggable between columns. Dragging a card to "In Progress" opens the split view.

### 6.4 Ticket creation

Slide-over panel from the right. Fields:

- **Title** — required, plain text, autofocused
- **Description** — required, CodeMirror Markdown editor. This exact text is passed to opencode as the initial prompt, so the developer should write it as a clear task instruction.
- **Repo** — required, dropdown. Choosing a repo auto-populates the base branch.
- **Category** — segmented control: Feature · Bug · Refactor · Chore · Docs. If a matching template exists at `~/.opendev/templates/{category}.md`, it pre-fills the description. The developer can edit freely before saving.
- **Priority** — segmented control: Low · Medium · High · Critical
- **Tags** — free-text, comma-separated

On save: ticket created with status `open`, branch `feat/{slug}` created in the repo via `git checkout -b`.

### 6.5 Split view — ticket detail

Opens when any ticket is clicked. Main area splits:

```
┌───────────────────────┬──────────────────────────────────────────┐
│  Left (380px)         │  Right (fluid)                           │
│                       │                                          │
│  ← Back  [⋮]         │  [Start session]  ← when no session     │
│                       │                                          │
│  Bug: Login fails     │  ── or, when session active ──          │
│  [needs_review] [high]│                                          │
│                       │  branch: feat/fix-login-abc1             │
│  Description          │  opencode v0.x.x · claude-opus-4-5      │
│  ─────────────        │                                          │
│  Fix the OAuth        │  ╔════════════════════════════════════╗  │
│  callback that...     │  ║  xterm.js terminal                 ║  │
│                       │  ║  opencode running here             ║  │
│  Notes  [edit]        │  ║  full interactive PTY              ║  │
│  ─────────────        │  ║                                    ║  │
│  Auto-saved notes     │  ╚════════════════════════════════════╝  │
│                       │                                          │
│  Files changed        │  Cost: $0.14 · 2m 31s · 4,820 tokens   │
│  ─────────────        │                                          │
│  src/auth.ts    +24   │  [■ Stop session]                       │
│  src/oauth.ts   +11   │                                          │
│                       │                                          │
│  Sessions             │                                          │
│  ─────────────        │                                          │
│  ▸ Session 1 $0.14 3m │                                          │
└───────────────────────┴──────────────────────────────────────────┘
```

**Left panel** — always visible and scrollable. Description is read-only. Notes are always editable, auto-saved on every keystroke with 500ms debounce. Files changed list updates in real time via SSE as opencode writes files. Sessions list links to past session transcripts.

**Right panel** — shows the active terminal when a session is running. When no session is active, shows a "Start session" button. When a session has ended and is awaiting review, shows the diff view (§8).

### 6.6 Starting a session

Clicking "Start session":

1. Server creates a Session record
2. Server spawns opencode via node-pty in the repo directory with the ticket description as the initial prompt
3. WebSocket connection opens: `/ws/terminal/{sessionId}`
4. xterm.js connects and the terminal goes live
5. Ticket status → `in_progress`
6. SSE event `session.started` broadcast

The terminal is fully interactive. The developer can type, interrupt, redirect, or ask follow-up questions directly in the terminal at any time — it's a real PTY.

### 6.7 Session complete banner

When opencode exits, a banner slides in above the terminal:

```
┌──────────────────────────────────────────────────────────────────┐
│  Session complete · 4m 12s · $0.31 · 8 files changed           │
│  [Review diff →]                        [Start new session]     │
└──────────────────────────────────────────────────────────────────┘
```

The right panel automatically transitions to the diff view when "Review diff" is clicked, or automatically after 3 seconds if the developer hasn't interacted.

### 6.8 Cost display

Every ticket card shows a cost badge: total USD for all sessions. Live-updating during an active session via SSE. Hover shows: N sessions · X tokens · $Y.ZZ. The sidebar shows this week's total spend, updating live.

Cost display rules:
- Below $0.01 shown as `< $0.01`
- USD to 2 decimal places: `$0.31`
- Token counts with comma separators: `14,320`

### 6.9 Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `N` | New ticket |
| `K` | Toggle Kanban / List |
| `Enter` | Open selected ticket |
| `Escape` | Close split view / panel |
| `⌘ Enter` | Start session |
| `⌘ .` | Stop session |
| `⌘ ⇧ D` | Jump to diff view |
| `?` | Show shortcuts overlay |

### 6.10 Settings

Accessible from the sidebar. Contains:

- **Repos** — add/remove repos, set env vars per repo, set default branch
- **opencode** — current version, "Check for update" button, auto-update toggle
- **Appearance** — light / dark / system theme

### 6.11 Empty states

**No repos:** Inline setup — a single text input asking for a repo path, with a "Browse" file picker. No redirect.

**No tickets:** A prompt: "Create your first ticket (N)" with the keyboard shortcut visible.

**Session panel, no session yet:** Agent selector (opencode only in v0.1), model shown as detected from opencode config, "Start session" button, and a one-line explanation: "opencode will run in this repo on branch feat/{slug}."

### 6.12 Frontend Error States

Every data-fetching view follows the same four-state pattern:

```
if (isLoading) → skeleton loader or spinner
if (isError)   → inline error message with retry button
if (isEmpty)   → empty state with action prompt
if (isSuccess) → normal content
```

**Error boundaries** — one per major section (sidebar, list/kanban, split view, settings). A crash in one section doesn't take down the rest. A global error boundary catches unhandled errors and shows "Something went wrong. [Reload]" with a "Copy error details" button.

**Specific error UI:**

| View | Error state | UI |
|------|-------------|-----|
| List view | API unreachable | Skeleton table → "Could not load tickets. [Retry]" |
| Kanban view | API unreachable | "Could not load board. [Retry]" — preserves last-known columns |
| Split view left panel | Ticket load fails | "Could not load ticket details. [Go back] [Retry]" |
| Split view right panel | Session start fails | Inline error in terminal area: "Could not start session: {reason}. [Retry]" |
| Diff view | Git diff fails | "Could not compute diff." with a toggle to view raw git output |
| Settings | Repo scan fails | Inline error per repo row: "Path not found" or "Not a git repository" |
| SSE connection | Lost connection | Auto-reconnect with exponential backoff. Toast after 3 failures: "Live updates disconnected. [Reload]" |

### 6.13 Accessibility

| Concern | Requirement |
|---------|-------------|
| **Keyboard navigation** | All interactive elements reachable and operable via keyboard alone. Tab order matches visual layout |
| **Focus management** | Split view: focus moves to terminal when session starts. Diff view: focus moves to file list. Slide-over panel: focus trapped while open |
| **ARIA roles** | Terminal panel: `role="application"`, `aria-label="opencode terminal for ticket {title}"`. Diff editor: `role="region"`, `aria-label="Diff for {filename}"`. Kanban cards: draggable with `aria-grabbed` |
| **Color-independent indicators** | Status badges use icons + text alongside color. Diff view: `+`/`-` prefixes in addition to green/red |
| **Live regions** | Terminal output rendered to `aria-live="polite"`. Session cost updates use `role="status"`. File changes use `role="log"` |
| **xterm.js a11y** | Enable `@xterm/addon-accessibility` — provides `aria-live` buffer of terminal content for screen readers |
| **Zoom support** | All panels support 200% browser zoom without layout breakage. xterm.js and Monaco handle this natively |
| **Reduced motion** | Respect `prefers-reduced-motion`: disable terminal cursor blink, slide-over panel animation, banner slide-in |

---

## 7. opencode Integration

### 7.1 How opencode runs

OpenDev does not manage opencode's config, providers, or auth — opencode handles all of that itself via `~/.config/opencode/` and `opencode auth`. The developer sets up opencode once on their machine and OpenDev just runs it.

When a session starts, the server executes:

```bash
opencode
  --cwd /path/to/repo
  --prompt "{ticket.description}"
  --session opendev-{sessionId}
```

opencode uses its own TUI, which renders inside xterm.js in the browser. The developer sees and interacts with the exact same opencode interface they'd see in a local terminal — just embedded in the browser.

### 7.2 Version management

OpenDev always wants to run the latest version of opencode. On every server startup:

1. Server checks the installed opencode version via `opencode --version`
2. Server checks the latest version from the npm registry (`opencode-ai` package) or GitHub releases API
3. If a newer version is available: `opencode upgrade` is run automatically before any session starts
4. The version used is recorded on every Session record (`session.opencodeVersion`)

The developer can disable auto-upgrade in Settings if they need to pin a version.

### 7.3 Transcript capture

node-pty streams PTY output to two consumers simultaneously:

1. The WebSocket connection → browser xterm.js (live display)
2. An in-memory buffer that flushes to `session.transcript` on exit

Each `TranscriptEntry` has a millisecond timestamp relative to session start, allowing full playback at any speed.

### 7.4 Cost parsing

opencode prints cost information to stdout at session end (and periodically during long sessions). The server parses these lines with a regex matched against opencode's known output format and emits `CostEvent` objects. These are:

- Forwarded over SSE to update the live cost badge in the browser
- Aggregated into the Session record on exit
- Written to a `CostRecord` row

The parser is versioned alongside opencode's output format. When opencode changes its cost output format, the parser is updated. The opencode version is recorded on every session so historical records remain accurate.

### 7.5 Files changed — live updates

opencode writes files during its session. The server uses a filesystem watcher (`chokidar`) scoped to the repo directory, filtering to the current branch's changes, and emits `session.file_changed` SSE events as files are written. The left panel's "Files changed" list updates in real time.

### 7.6 Project context injection

When a session starts, OpenDev checks for `{repo.localPath}/.opendev/context.md`. If the file exists, it's prepended to the session prompt before the ticket description:

```
[Project context]
{content of context.md}

[Ticket]
{ticket.description}

Go ahead and work on this.
```

The developer edits `context.md` in their editor to keep it current with the project. If the file doesn't exist, the prompt is just the ticket description — no error, no friction.

---

## 8. Diff & Review Flow

### 8.1 Diff computation

On session exit, the server runs:

```bash
git diff {baseBranch}...{branch} --name-status
git diff {baseBranch}...{branch} -- {file}     # per file
```

Results are stored as `FileDiff[]` on the Session record and returned to the browser via REST when the diff view opens.

### 8.2 Diff view layout

The right panel replaces the terminal with the diff view:

```
┌──────────────────────────────────────────────────────────────────┐
│  4 files changed · +142 / -31 · Session 1                       │
│                                                                  │
│  [✓ Accept all and commit]          [↩ Request revision]        │
├──────────────────────────────────────────────────────────────────┤
│  File list                │  Monaco diff editor                  │
│                           │                                      │
│  ✓ src/auth.ts      +24  │  ←── before ──────── after ──→      │
│  ✓ src/oauth.ts     +11  │                                      │
│  ✓ tests/auth.test  +18  │  (full side-by-side diff for        │
│  ✗ README.md         +4  │   the selected file)                 │
│                           │                                      │
│  [✓ Accept] [✗ Reject]   │                                      │
│  (per file)               │                                      │
└──────────────────────────────────────────────────────────────────┘
```

Clicking a file in the list loads it in the Monaco diff editor. Files default to accepted (checkmark). The developer can reject individual files — rejected files are excluded from the commit.

### 8.3 Accept all and commit

1. Rejected files are reverted: `git checkout {baseBranch} -- {path}` for each rejected file
2. Accepted changes are committed: `git add -A && git commit -m "opendev: {ticket.title} [#{ticket.id}]"`
3. Session marked approved
4. Ticket status → `resolved`
5. SSE event `ticket.resolved` broadcast

### 8.4 Request revision

1. Developer types a revision note (e.g. "Also update the tests" or "The error message is wrong")
2. A new session starts immediately with the terminal reopening
3. The new session's initial prompt is: the original ticket description + the revision note
4. The diff view accumulates diffs across all sessions on this branch
5. This loop repeats until the developer accepts

---

## 9. Cost Tracking

### 9.1 Data flow

```
opencode stdout
    │  server parses cost lines
    ▼
CostEvent { sessionId, promptTokens, completionTokens, model, ts }
    │
    ├── SSE → browser (live badge update)
    └── Aggregated → Session.costUsd + CostRecord row on session end
```

### 9.2 Cost views

**Per ticket** — cost badge on every ticket card in List and Kanban views. Shown in the left panel of the split view.

**Per session** — each session in the session history list shows its individual cost and token count.

**Weekly summary** — sidebar shows total spend and tokens for the current week, updated live.

**Cost history** — a dedicated view accessible from Settings shows:
- Daily spend for the last 30 days (bar chart)
- Breakdown by repo
- Top 10 most expensive tickets
- Model breakdown (if multiple models detected)

All cost data is local. No telemetry, no external service.

---

## 10. Notifications

All real-time updates are delivered via SSE. No polling anywhere in the UI.

| Event | SSE type | UI result |
|-------|----------|-----------|
| Session started | `session.started` | Terminal goes live, status → in_progress |
| File changed | `session.file_changed` | Left panel files list updates |
| Cost update | `session.cost` | Cost badge updates live |
| Session ended | `session.ended` | Banner shown, diff view loads |
| Ticket resolved | `ticket.resolved` | Status badge updates everywhere |
| opencode upgraded | `system.opencode_upgraded` | Toast: "opencode updated to v0.x.x" |

Browser tab title shows the active session cost when a session is running: `OpenDev · $0.14`.

---

## 11. Build Phases

### Phase 1 — Working end-to-end (v0.1)

Ship a complete, working loop. Nothing else.

- `opendev` CLI: starts server, opens browser
- SQLite + Drizzle setup, migrations
- Repo configuration (local path, default branch, env vars)
- Ticket CRUD: create, edit, delete
- List view + Kanban view
- Split view: left panel + terminal panel
- node-pty spawning opencode, streamed to xterm.js via WebSocket
- Branch auto-creation on session start
- Transcript capture
- Session complete banner
- Diff view (Monaco)
- Accept all → git commit
- Cost parsing + live badge
- SSE for all real-time updates
- opencode version check + auto-upgrade on startup

**Done when:** Create a ticket, start opencode in the browser, review the diff, commit — all in one window.

### Phase 2 — Review loop (v0.2)

Make the review flow complete and the terminal fully useful.

- Per-file accept / reject in diff view
- Request revision → new session with follow-up prompt
- Cumulative diff across sessions on the same branch
- Session replay (playback at 1×, 2×, 4×)
- Files changed live list (chokidar watcher)
- Keyboard shortcuts (full set)
- Cost history view (30-day chart, per-repo, per-ticket)
- Settings UI (repos, opencode version, theme)

**Done when:** The full review loop works — accept, reject, revise — and the developer can review past sessions.

### Phase 3 — Polish (v0.3)

Make it feel production-quality for daily use.

- Full-text search across tickets and session transcripts
- Ticket templates (per category: bug template pre-fills reproduction steps, etc.)
- Session transcript export (Markdown or JSON)
- `opencode stats` integration — surface opencode's own stats in the cost view
- Drag-and-drop in Kanban
- Keyboard navigation in List view (arrow keys, Enter, Escape)
- Branch cleanup: delete `feat/` branches on ticket close (configurable)
- Onboarding flow for first-time setup (repo picker, opencode auth check)

**Done when:** A developer uses OpenDev as their daily driver without friction.

---

## 12. Tech Stack

### Frontend

| Concern | Choice |
|---------|--------|
| Framework | React 19 + Vite |
| Language | TypeScript |
| Server state | TanStack Query |
| Client state | Zustand |
| Routing | TanStack Router |
| Terminal | xterm.js + @xterm/addon-fit + @xterm/addon-web-links |
| Diff editor | Monaco Editor (MonacoDiffEditor) |
| Markdown editor | CodeMirror 6 + @codemirror/lang-markdown |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |

### Backend

| Concern | Choice |
|---------|--------|
| Runtime | Bun |
| Framework | Fastify |
| Language | TypeScript |
| ORM | Drizzle ORM |
| Database | SQLite via bun:sqlite |
| PTY | node-pty |
| Git | simple-git |
| File watcher | chokidar |
| WebSocket | @fastify/websocket |
| SSE | Fastify native response streams |

### Distribution

| Concern | Choice |
|---------|--------|
| Package | npm (`opendev` / `opendev-ai`) |
| Install | `bun install -g opendev` or `bunx opendev` (also works via `npm install -g opendev`) |
| Data dir | `~/.opendev/` |
| DB file | `~/.opendev/db.sqlite` |
| Logs | `~/.opendev/logs/` |
| Templates | `~/.opendev/templates/` — global per-category ticket templates (`bug.md`, `feature.md`, etc.) |

---

## 13. Open Questions

Decisions to make before Phase 2.

**Q1: How does opencode receive the initial prompt non-interactively?**  
opencode has `opencode run "prompt"` for non-interactive mode and `opencode --prompt "..."` for TUI mode with a pre-filled prompt. The TUI mode is preferred since it gives the developer full interaction. Confirm the exact flag behavior with the latest opencode version before implementing.

**Q2: What does the cumulative diff look like across multiple sessions?**  
If the developer requests two revisions, there are three sessions on the same branch with multiple commits. The diff view should show the cumulative diff from `baseBranch` to `HEAD`, not just the last session. This is straightforward with `git diff baseBranch...branch` but needs UX thought: should the developer be able to browse per-session diffs too?

**Q3: What happens when opencode's cost output format changes?**  
The cost parser is tied to opencode's stdout format. Since opencode auto-updates, the parser may break after an upgrade. Options: (a) parse from `opencode stats` CLI output after session end instead of stdout — more stable; (b) use opencode's JSON output mode (`--format json`) if available. Check opencode's `run --format json` flag for structured output.

**Q4: Branch naming collision.**  
If the developer creates two tickets with similar titles, the auto-generated branch names may collide. Append a short UUID suffix to branch names: `feat/{slug}-{id[:8]}`. Confirm this is acceptable UX.

**Q5: What if opencode is not installed?**  
On startup, if `opencode` is not in PATH, show an onboarding screen with install instructions (`bun install -g opencode-ai` or `npm install -g opencode-ai`) and a "Check again" button. Do not silently fail.

---

## 14. Testing Strategy

### Test runner

Use `bun test` as the single test runner for everything — unit, integration, and component tests. No Vitest, no Jest, no separate runner.

### Test layers

| Layer | Tool | What it covers | Location |
|-------|------|----------------|----------|
| **Unit** | `bun test` | DB queries, cost parser, prompt builder, git wrapper, SSE event builder | `src/**/*.test.ts` (co-located) |
| **Integration** | `bun test` + `bun:sqlite` (in-memory) | API routes, WebSocket handshake, full request/response cycle | `src/**/*.test.ts` (same files) |
| **Component** | `bun test` + React Testing Library | React components in isolation (ticket form, diff view, sidebar), mocked API | `src/**/*.test.tsx` (co-located) |
| **E2E** | Playwright | Full flow: create ticket → session starts → terminal renders → diff appears → commit | `e2e/` directory |

### Test DB strategy

Each test creates a fresh in-memory SQLite database via `bun:sqlite`. No cleanup needed — the database is destroyed when the test context ends. Drizzle ORM connects to it normally.

```
// example
const db = drizzle(new Database(":memory:"));
// run migrations, seed data, test, done
```

### PTY mocking

- **Unit tests:** Mock `node-pty` entirely. Assert that spawn is called with the right arguments
- **Integration tests:** Use a real PTY running a shell script that echoes known output — validates the full spawn → output → capture → parse pipeline
- **E2E:** Real opencode process (requires opencode installed in CI)

### Git mocking

- **Unit tests:** Mock `simple-git` calls where possible
- **Integration tests:** Create a temp git repo with `node:fs` before each test, run real git operations against it, destroy after
- **E2E:** Real git in a temp repo

### Coverage targets

| Metric | Target |
|--------|--------|
| Unit test coverage | 80% |
| Integration coverage | 60% |
| E2E critical paths | All Phase 1 flows |

### CI execution

```bash
bun test                  # unit + integration + component tests (no --coverage in CI to save time)
bun run test:e2e          # Playwright — runs only on PRs to main
```

---

## 15. CI/CD

### Package registry

npm (`opendev` / `opendev-ai`). Published via `bun publish` (compatible with npm registry).

### CI pipeline (GitHub Actions)

File: `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun test
      - run: bun run build
  e2e:
    if: github.base_ref == 'main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: npx playwright install --with-deps
      - run: bun run test:e2e
```

### Publish pipeline (GitHub Actions)

File: `.github/workflows/publish.yml`

```yaml
name: Publish
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun publish
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Versioning

- **Semver** — major/minor/patch follows standard rules
- **Pre-1.0:** `0.x.z`. Breaking changes increment `x`, features and patches increment `z`
- **Git tags:** `v0.1.0`, `v0.1.1`, etc. — created when a GitHub Release is published
- **Changelog:** `CHANGELOG.md` at repo root, updated manually or via `bunx standard-version`

### Build output

`bun run build` produces:
- `/dist/server/` — compiled Bun/Fastify server code
- `/dist/client/` — built Vite frontend (served as static files by Fastify)

`package.json` `bin` field: `{"opendev": "./dist/server/cli.js"}`

### Vercel — project site

The GitHub repo is linked to Vercel for automatic deployment of:
- **Landing page / marketing site** at `opendev.dev` (or similar domain)
- **Documentation site** at `docs.opendev.dev` (Phase 2)

Vercel auto-deploys on every push to `main`. No manual deploy steps. The OpenDev application itself is not hosted on Vercel — it's a local tool.
