# OpenTack

**Track your opencode work like a pro — without leaving your browser.**

OpenTack is a lightweight local dashboard that sits on top of [opencode](https://github.com/anomalyco/opencode). It turns your opencode sessions into tickets — giving you a bird's-eye view of everything you're working on, what you've done, and how much it cost.

## Why?

opencode is great at what it does — it's an AI coding agent that runs in your terminal. But once you have multiple projects going, it's easy to lose track:

- Which repos am I working on?
- What was I doing in that session yesterday?
- How much did that feature cost in API tokens?

OpenTack gives you a simple browser interface to answer all of that. Think of it like a lightweight Jira for your local AI coding sessions — but without the setup, the cloud, or the complexity.

## How it works

OpenTack runs entirely on your machine. Nothing leaves your computer.

1. **Add repos** — point OpenTack at any local Git repo, or clone from GitHub
2. **Create tickets** — give each ticket a title, description, priority, category, and repo
3. **Start a session** — OpenTack fires up opencode's web UI in a split panel, linked to that ticket
4. **Code** — talk to opencode in the right panel while viewing ticket details on the left
5. **Track** — see active sessions, weekly costs, activity history, and more

Switch between **Overview** (dashboard with stats, cost charts, activity timeline), **List** (filterable table), and **Board** (drag-and-drop Kanban). Each ticket tracks its session history, token usage, and cost automatically.

## Quick start

### Prerequisites

- [Bun](https://bun.sh) (JavaScript runtime)
- [opencode](https://github.com/anomalyco/opencode) (the AI coding agent)

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/anas1412/opentack/main/opentack.sh | bash
```

Or do it manually:

```bash
# Clone the repo
git clone https://github.com/anas1412/opentack.git
cd opentack

# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Build the frontend and server
bun run build

# Start
bun run dev
```

Open **http://localhost:3000** in your browser.

### CLI

```bash
# After building, you can also run it directly:
./dist/server/cli.js
# Or if linked globally:
opentack
# Set a custom port:
OPENTACK_PORT=4000 opentack
```

### Update

```bash
git pull
bun install
bun run db:migrate
bun run build
```

### Uninstall

```bash
cd ..
rm -rf opentack
rm -rf ~/.opentack
```

### Add a repo

Click the **+** button in the sidebar under Repos. You have two options:

**Local folder** — pick any local Git repository. OpenTack detects the repo name and branch automatically.

**Clone from GitHub** — paste a git URL (SSH or HTTPS). OpenTack clones it to `~/.opentack/repos/` and adds it automatically.

> **Private repos**: If cloning fails with a permission error, make sure you have SSH keys set up:
> ```
> ssh -T git@github.com          # test your SSH connection
> ssh-add -l                      # list loaded keys
> ssh-add ~/.ssh/id_ed25519       # add your key to the agent
> ```
> Or use an HTTPS URL with a personal access token:
> ```
> https://<username>:<token>@github.com/user/repo.git
> ```
> Create a token at https://github.com/settings/tokens.

### Create a ticket

Click **New ticket**, give it a title, description, priority, category, and assign it to a repo.

### Start working

Click **Start session**. OpenTack launches opencode's web UI in the right panel. Every message is saved to the ticket's session history. Stop the session when done; resume it later from where you left off.

## Views

| View | Description |
|---|---|
| **Overview** | Dashboard with stat cards, daily usage chart (30 days), recent tickets, activity timeline, and per-repo cost breakdown |
| **List** | Filterable ticket table with search, status, priority, and category filters |
| **Board** | Drag-and-drop Kanban with columns: Open, In Progress, Needs Review, Changes Requested, Resolved |
| **Settings** | Theme picker (amber/emerald/violet/sky), default opencode model, forward-description toggle, per-repo environment variables |

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start the server (default port 3000) |
| `bun run build` | Build client + server for production |
| `bun run build:client` | Build only the frontend (Vite) |
| `bun run build:server` | Build only the server (Bun bundle) |
| `bun run db:migrate` | Apply database migrations |
| `bun run db:generate` | Generate migrations from schema |
| `bun run typecheck` | Type-check the codebase |
| `bun test` | Run tests |

## Tech stack

- **Frontend**: React 19, Tailwind CSS 4, Vite, zustand, TanStack Query, TanStack Router, lucide-react
- **Backend**: Fastify 5 (Bun runtime)
- **Database**: SQLite via Drizzle ORM
- **AI**: Powered by opencode

## License

MIT
