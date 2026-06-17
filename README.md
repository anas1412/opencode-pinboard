# OpenTack

**Track your opencode work like a pro — without leaving your browser.**

OpenTack is a lightweight local dashboard that sits on top of [opencode](https://github.com/anas1412/opencode). It turns your opencode sessions into tickets — giving you a bird's-eye view of everything you're working on, what you've done, and how much it cost.

![screenshot](https://github.com/anas1412/opentack/raw/main/docs/screenshot.png)

## Why?

opencode is great at what it does — it's an AI coding agent that runs in your terminal. But once you have multiple projects going, it's easy to lose track:

- Which repos am I working on?
- What was I doing in that session yesterday?
- How much did that feature cost in API tokens?

OpenTack gives you a simple browser interface to answer all of that. Think of it like a lightweight Jira for your local AI coding sessions — but without the setup, the cloud, or the complexity.

## How it works

OpenTack runs entirely on your machine. Nothing leaves your computer.

1. **You add repos** — point OpenTack at any local Git repo
2. **You create tickets** — each ticket is a task or feature you want to work on
3. **You start a session** — OpenTack fires up opencode's web UI inside your browser, linked to that ticket
4. **You code** — talk to opencode through its own interface, right in the panel next to your ticket
5. **You track** — see your active sessions, weekly costs, and history all in one place

When you're done, stop the session. Want to pick it back up later? Start a new session — the full conversation history is still there.

## Quick start

### Prerequisites

- [Bun](https://bun.sh) (JavaScript runtime)
- [opencode](https://github.com/anas1412/opencode) (the AI coding agent)

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

# Build the frontend
bun run build
```

### Run

```bash
bun run dev
```

Open **http://localhost:3000** in your browser.

### Update

```bash
# From the opentack directory:
git pull
bun install
bun run db:migrate
bun run build
```

### Uninstall

```bash
# From the opentack directory:
# (keeps bun and opencode, only removes OpenTack)
cd ..
rm -rf opentack
rm -rf ~/.opentack
```

### Add a repo

Click the **+** button in the sidebar. You have two options:

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

Click **New ticket**, give it a title and description, and assign it to a repo.

### Start working

Click **Start session**. OpenTack will launch opencode's web UI in the right panel. Every message you send is saved to the ticket's session history.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start the server (default port 3000) |
| `bun run build` | Build everything for production |
| `bun run db:migrate` | Apply database migrations |
| `bun run typecheck` | Type-check the codebase |

## Tech stack

- **Frontend**: React 19, Tailwind CSS 4, Vite
- **Backend**: Fastify (Bun runtime)
- **Database**: SQLite via Drizzle ORM
- **AI**: Powered by opencode

## License

MIT
