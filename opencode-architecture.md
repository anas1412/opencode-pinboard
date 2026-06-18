# OpenCode Architecture & API Reference

> Based on opencode v1.16.2 source code and Context7 docs (June 2026).

## 1. Core Architecture

Every `opencode` process runs as **two parts**:

```
opencode [project]
  ├── TUI (terminal UI)    ← the interactive interface
  └── Server (HTTP/WS)     ← local API server for the TUI client
```

The TUI is **a client** that connects to the local server. The server is what does the actual work (LLM calls, file operations, git operations, etc.). This means you can run **just the server** without the TUI:

```
opencode serve
```

This starts a headless HTTP server with:
- OpenAPI 3.1 spec at `http://<host>:<port>/doc`
- REST API for project and session management
- WebSocket for real-time PTY/terminal connections
- SSE endpoint for streaming events
- Serves its own web UI at `GET /`

## 2. `opencode serve` - Headless Server

### Starting

```bash
opencode serve --port 4096 --hostname 127.0.0.1
```

Options:
| Flag | Default | Description |
|------|---------|-------------|
| `--port` | random | Port to listen on |
| `--hostname` | `127.0.0.1` | Host to bind to |
| `--mdns` | false | Enable mDNS discovery (sets hostname to 0.0.0.0) |
| `--mdns-domain` | `opencode.local` | Custom mDNS domain |
| `--cors` | `[]` | Additional CORS origins |
| `--print-logs` | false | Print logs to stderr |
| `--log-level` | `INFO` | DEBUG, INFO, WARN, ERROR |
| `--pure` | false | Run without external plugins |

### Server Config (opencode.json)

```json
{
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0",
    "mdns": true,
    "cors": ["http://localhost:5173"]
  }
}
```

### OpenAPI Spec

Available at `http://<host>:<port>/doc` (OpenAPI 3.1 JSON). Can be used to generate SDK clients.

### Warning

If `OPENCODE_SERVER_PASSWORD` env var is not set, the server logs:

```
Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.
```

## 3. Project & Session API (v1)

From `specs/project.md` — the original RESTful API for projects and sessions.

### Projects

```
GET  /project          → Project[]          # List all projects
POST /project/init     → Project            # Create/init a project
```

### Sessions within a Project

```
GET  /project/:projectID/session                         → Session[]
GET  /project/:projectID/session/:sessionID              → Session
POST /project/:projectID/session                         → Session     # Create session
     Body: { id?: string, parentID?: string, directory: string }
DELETE /project/:projectID/session/:sessionID                          # Delete session
POST /project/:projectID/session/:sessionID/init                       # Initialize/start session
POST /project/:projectID/session/:sessionID/abort                      # Abort session
POST /project/:projectID/session/:sessionID/share                      # Share session
DELETE /project/:projectID/session/:sessionID/share                    # Unshare
POST /project/:projectID/session/:sessionID/compact                    # Compact session
POST /project/:projectID/session/:sessionID/revert                     # Revert to previous
POST /project/:projectID/session/:sessionID/unrevert                   # Undo revert
POST /project/:projectID/session/:sessionID/permission/:permissionID   # Answer permission
```

### Messages within a Session

```
GET  /project/:projectID/session/:sessionID/message              → { info: Message, parts: Part[] }[]
GET  /project/:projectID/session/:sessionID/message/:messageID   → { info: Message, parts: Part[] }
POST /project/:projectID/session/:sessionID/message              → { info: Message, parts: Part[] }
```

### Files

```
GET /project/:projectID/session/:sessionID/find/file     → string[]       # Find files
GET /project/:projectID/session/:sessionID/file          → { type: "raw" | "patch", content: string }
GET /project/:projectID/session/:sessionID/file/status   → File[]
```

### Other Endpoints

```
GET  /provider?directory=<path>     → Provider   # Get provider config for directory
GET  /config?directory=<path>       → Config     # Get config for directory
GET  /project/:projectID/agent?directory=<path>    → Agent
GET  /project/:projectID/find/file?directory=<path> → File[]
POST /log                                            # Log something
```

## 4. V2 Session API

From source code at `packages/opencode/src/server/routes/instance/httpapi/groups/v2/session.ts`.

### List Sessions

```
GET /api/session?cursor=<string>&limit=<number>&directory=<path>
```

Response:
```json
{
  "items": [ SessionV2.Info ],
  "cursor": { "previous": "string | null", "next": "string | null" }
}
```

### Send Prompt (Streamed)

```
POST /api/session/:sessionID/prompt
```

Body:
```json
{
  "prompt": {
    "parts": [{ "type": "text", "text": "Fix the login bug" }],
    "model": { "providerID": "anthropic", "modelID": "claude-3-5-sonnet-20241022" },
    "agent": "agent-id",
    "variant": "high",
    "directory": "/path/to/repo"
  },
  "delivery": "stream" | null
}
```

Response: **Streamed JSON** — the prompt response is streamed as newline-delimited JSON events containing the message with all parts (text, tool_use, etc.).

If `delivery` is omitted or `null`, the session processes the prompt. If `delivery` is `"stream"`, it streams the response in real-time.

### sessions.create (SDK)

```javascript
sessions.create({ id?, location: "path/to/repo", ... })
```

- If `id` is omitted, generates a new session ID
- If `id` is provided and session doesn't exist, creates it
- If `id` is provided and session exists, returns existing session identity
- `location` is required (maps to directory/repo path)

### sessions.prompt (SDK)

```javascript
sessions.prompt({ id?, sessionID, prompt, delivery?, resume? })
```

- `id`: Optional message ID (generated if omitted)
- `sessionID`: Required session ID
- `prompt`: The prompt string
- `delivery`: Optional delivery mode
- `resume`: If true (default), schedules execution. If false, admits without scheduling.

## 5. SDK Client

### Installation

```bash
npm install @opencode-ai/sdk
```

### Create Client Only (connect to existing server)

```javascript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096"
})
```

### Create Client + Server (start embedded)

```javascript
import { createOpencode } from "@opencode-ai/sdk"

const { client, server } = await createOpencode()
// server.url -> the URL the server is listening on
```

### Session CRUD + Prompt

```javascript
// Create
const session = await client.session.create({
  body: { title: "My session" }
})

// List
const sessions = await client.session.list()

// Send prompt
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    model: { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
    parts: [{ type: "text", text: "Hello!" }],
  }
})

// Inject context (no AI response)
await client.session.prompt({
  path: { id: session.id },
  body: {
    noReply: true,
    parts: [{ type: "text", text: "You are a helpful assistant." }],
  }
})
```

### Listen to Real-time Events

```javascript
const events = await client.event.subscribe()
for await (const event of events.stream) {
  console.log("Event:", event.type, event.properties)
}
```

The server exposes an SSE endpoint at (path not specified in docs, likely `/api/events` or similar) that streams events filtered by workspace/directory.

## 6. Event Streaming (SSE)

The server has an SSE endpoint for real-time events. From source code analysis:

```
GET /api/events (likely path)
```

Events are streamed as SSE with format:
```
id: <event_id>
event: <event_type>
data: { "id": "...", "type": "...", "properties": { ... } }
```

Event types include:
- `server.connected` — initial connection event
- `session.created`, `session.deleted`, `session.aborted`
- `message.created`, `message.completed`
- `permission.requested`, `permission.answered`
- `agent_message_chunk` — streaming text deltas during AI response
- `tool_use`, `tool_result`
- File changes (create, edit, delete)

Events are filtered by workspace/directory — only events for the relevant project are sent.

## 7. `opencode run` - Headless Execution

Run a one-shot prompt without the TUI:

```bash
opencode run "Fix the login bug"
opencode run --attach http://localhost:4096 "Explain async/await"
```

### Attach Mode

```bash
# Start server first
opencode serve --port 4096

# In another terminal, attach and run
opencode run --attach http://localhost:4096 --dir /path/to/repo "Fix the bug"
```

This avoids cold boot times — the server stays warm between runs.

### JSON Output Format

```bash
opencode run --format json "Fix the bug"
```

Outputs newline-delimited JSON events:
```json
{"type":"step_start","timestamp":"...","sessionID":"...","data":{...}}
{"type":"text","timestamp":"...","sessionID":"...","data":{"text":"..."}}
{"type":"tool_use","timestamp":"...","sessionID":"...","data":{"tool":"...","input":{...}}}
{"type":"step_finish","timestamp":"...","sessionID":"...","data":{...}}
```

### Key Flags

| Flag | Description |
|------|-------------|
| `--attach <url>` | Connect to running server instead of starting a new one |
| `--format json` | Output structured JSON events (not formatted text) |
| `--dir <path>` | Working directory (remote path if attaching) |
| `--session <id>` (or `-c`) | Continue an existing session |
| `--fork` | Fork session before continuing (needs --continue/--session) |
| `--model <provider/model>` | Model to use (e.g., anthropic/claude-3-5-sonnet) |
| `--agent <id>` | Agent to use |
| `--file <path>` | Attach file(s) to message |
| `--title <title>` | Session title |
| `--port <port>` | Local server port (default: random) |
| `--command <cmd>` | Command to run (use message for args) |
| `-i` / `--interactive` | Run in interactive split-footer mode |
| `--thinking` | Show thinking blocks |
| `--dangerously-skip-permissions` | Auto-approve all permissions |

## 8. How the TUI Client Uses the Server

The TUI client (`opencode [project]`) connects to the local server and:

1. Lists/creates sessions via the API
2. Sends prompts via `POST /api/session/:id/prompt`  
3. Receives streamed responses (JSON events)
4. Subscribes to SSE events for real-time updates
5. Shows file diffs, permission requests, etc.

The ACP (Agent Client Protocol) adapter also connects to the server, creating a bridge between external tools and opencode.

## 9. Key Integration Points for OpenTack

### Option A: PTY + Terminal (Current)

```
OpenTack → spawn opencode [cwd] in node-pty → stream TTY bytes via xterm.js WebSocket
```

Problems:
- PTY dies on server restart
- Terminal output is raw VT escape sequences, hard to parse
- Can't get structured data (JSON events, file diffs)

### Option B: Headless Server + HTTP API (Recommended)

```
OpenTack Server
  ├── spawn opencode serve --port <port> (per repo or per session)
  ├── create sessions via POST /project/:id/session
  ├── send prompts via POST /project/:id/session/:sid/message
  ├── stream responses as JSON events to browser via SSE/WebSocket
  └── abort via POST .../abort
```

Advantages:
- Structured JSON responses, not terminal noise
- Server survives restart (stateless HTTP)
- Can use SDK or raw HTTP API
- Built-in SSE for real-time events
- Can attach multiple clients to same server

### Option C: SDK Embedded

```
OpenTack Server
  ├── import { createOpencode } from "@opencode-ai/sdk"
  ├── const { client, server } = await createOpencode()
  ├── client.session.create({ body: { directory } })
  └── client.session.prompt(...)
```

Advantages:
- No subprocess management
- Direct TypeScript API
- Clean lifecycle

### Option D: `opencode run --attach` to shared server

```
OpenTack Server
  ├── spawn opencode serve --port 4096 (one per user/repo)
  ├── for each user prompt: opencode run --attach http://localhost:4096 --format json
  └── capture JSON events and relay to browser
```

Advantages:
- Reuses warm server (no cold boot)
- `--format json` gives structured events
- Simple to implement

## 10. Current Gaps / Unknowns

1. Exact SSE endpoint path — likely `/api/events` but needs verification
2. How to create a project via SDK — the SDK example uses `client.session.create` directly, suggesting projects may be auto-created
3. Authentication — server supports password auth but defaults to unsecured
4. Multiple concurrent sessions — whether one server can handle simultaneous sessions
5. Port allocation — whether to use one server per repo or one per user
