# Rename OpenTack → Pinboard

**Goal:** Rename every occurrence of "OpenTack"/"opentack" in the project to "Pinboard"/"pinboard" with zero exceptions.

## Naming Conventions

| Context | Old | New |
|---------|-----|-----|
| npm package name | `opentack` | `opencode-pinboard` |
| CLI binary | `opentack` | `pinboard` |
| App display name (UI/title) | `OpenTack` | `Pinboard` |
| GitHub repo | `anas1412/opentack` | `anas1412/opencode-pinboard` |
| Data directory | `~/.opentack/` | `~/.pinboard/` |
| Install directory | `~/opentack` | `~/.pinboard` (keep consistent with data dir) |
| Worktrees directory | `~/opentack-worktrees` | `~/pinboard-worktrees` |
| Env var (install dir) | `OPENTACK_DIR` | `PINBOARD_DIR` |
| Env var (data dir) | `OPENTACK_DATA_DIR` | `PINBOARD_DATA_DIR` |
| Env var (db path) | `OPENTACK_DB_PATH` | `PINBOARD_DB_PATH` |
| Desktop identifier | `com.opentack.app` | `com.pinboard.app` |
| Desktop file | `opentack.desktop` | `pinboard.desktop` |
| Desktop app name (electrobun) | `OpenTack` | `Pinboard` |
| Installer binary | `opentack-install` | `pinboard-install` |
| Release assets | `opentack-install-linux/windows` | `pinboard-install-linux/windows` |
| Domain | `releases.opentack.dev` | `releases.pinboard.dev` |
| Logo files | `opentack-logo.*` / `opentack_logo.*` | `pinboard-logo.*` / `pinboard_logo.*` |
| Shell script | `opentack.sh` | `pinboard.sh` |
| Batch script | `opentack.bat` | `pinboard.bat` |
| PRD document | `OpenTack-PRD.md` | `Pinboard-PRD.md` |
| Commit prefix | `opentack: {title}` | `pinboard: {title}` |
| opencode `--session` flag | `--session opentack-{id}` | `--session pinboard-{id}` |
| RPC type | `OpenTackRPC` | `PinboardRPC` |
| Log file prefix | `opentack-{YYYY-MM-DD}.log` | `pinboard-{YYYY-MM-DD}.log` |
| PBKDF2 salt | `opentack-gh-token-v1` | `pinboard-gh-token-v1` |
| PBKDF2 key suffix | `-opentack-key` | `-pinboard-key` |
| Console log prefix | `[opentack]` | `[pinboard]` |

---

## Phase 1 — README & Docs (5 files)

### 1.1 `README.md`
- Replace all `OpenTack` → `Pinboard` and `opentack` → `pinboard`
- Update install curl URL: raw GitHub URL changes
- Update clone URL: `anas1412/opentack.git` → `anas1412/opencode-pinboard.git`
- Update `opentack.sh` → `pinboard.sh`
- Update paths: `~/.opentack/` → `~/.pinboard/`, `~/opentack-worktrees` → `~/pinboard-worktrees`
- Update binary names: `opentack-install-linux` → `pinboard-install-linux`, etc.
- Update build commands: `opentack-install` → `pinboard-install`
- Update uninstall instructions (paths)

### 1.2 `OpenTack-PRD.md` → Rename to `Pinboard-PRD.md`
- Replace all occurrences throughout the document (too many to list individually — full find+replace)
- Key paths: `bunx opentack` → `bunx pinboard`, `~/.opentack/` → `~/.pinboard/`, `opentack-{sessionId}` → `pinboard-{sessionId}`
- Update npm publish name: `opentack` → `opencode-pinboard`
- Update domain references: `opentack.dev` → `pinboard.dev`
- Update commit message prefix

### 1.3 `WINDOWS_PORTABILITY_PLAN.md`
- Replace all `OpenTack` → `Pinboard` and `opentack` → `pinboard`
- `opentack.sh` → `pinboard.sh`, `opentack.bat` → `pinboard.bat`

### 1.4 `opencode-architecture.md`
- Replace all `OpenTack` → `Pinboard` (section header, body text)

### 1.5 `plans/sdk-migration-plan.md`
- One comment reference: `OpenTack's own SSE` → `Pinboard's own SSE`

---

## Phase 2 — Config Files (4 files)

### 2.1 `package.json`
- `name`: `"opentack"` → `"opencode-pinboard"`
- `description`: `"Native desktop app for managing opencode tickets, sessions, and costs"` (keep, it's fine)
- `bin`: `"opentack"` → `"pinboard"`
- `build:installer` script: `dist/opentack-install` → `dist/pinboard-install`

### 2.2 `electrobun.config.ts`
- `name: "OpenTack"` → `name: "Pinboard"`
- `identifier: "com.opentack.app"` → `identifier: "com.pinboard.app"`
- `baseUrl: "https://releases.opentack.dev/"` → `baseUrl: "https://releases.pinboard.dev/"`

### 2.3 `drizzle.config.ts`
- DB path reference: `~/.opentack/` → `~/.pinboard/`

### 2.4 `vite.config.ts`
- No changes needed (no OpenTack references)

---

## Phase 3 — Shell/Batch Scripts (2 files)

### 3.1 `opentack.sh` → Rename to `pinboard.sh`
- Line 2 header: `opentack.bat` → `pinboard.bat`, `opentack-install` → `pinboard-install`
- Line 5: `REPO="anas1412/opentack"` → `REPO="anas1412/opencode-pinboard"`
- Line 7: `OPENTACK_DIR` → `PINBOARD_DIR`, `$HOME/opentack` → `$HOME/.pinboard`
- Line 8: `OPENTACK_DATA_DIR` → `PINBOARD_DATA_DIR`, `$HOME/.opentack` → `$HOME/.pinboard`
- Line 116: banner `OpenTack — Install` → `Pinboard — Install`
- Line 130: `Cloning OpenTack` → `Cloning Pinboard`
- Line 162: `OpenTack is installed!` → `Pinboard is installed!`
- Line 177: banner `OpenTack — Update` → `Pinboard — Update`
- Line 182: `No OpenTack installation found` → `No Pinboard installation found`
- Line 183: URL update (repo rename)
- Line 223: `OpenTack is up to date!` → `Pinboard is up to date!`
- Line 232: banner `OpenTack — Uninstall` → `Pinboard — Uninstall`
- Line 253: `OpenTack has been uninstalled.` → `Pinboard has been uninstalled.`
- Line 261: `OpenTack — local ticket-based workspace` → `Pinboard — local ticket-based workspace`
- Line 266: `Install OpenTack` → `Install Pinboard`
- Line 267: `Update OpenTack` → `Update Pinboard`
- Line 268: `Remove OpenTack` → `Remove Pinboard`

### 3.2 `opentack.bat` → Rename to `pinboard.bat`
- Line 2: `OpenTack launcher` → `Pinboard launcher`
- Line 3: `opentack [command]` → `pinboard [command]`
- Line 13: `OpenTack -- local ticket-based workspace` → `Pinboard -- local ticket-based workspace`
- Line 15: `opentack [command]` → `pinboard [command]`
- Line 18: `Install OpenTack` → `Install Pinboard`
- Line 19: `Update OpenTack` → `Update Pinboard`
- Line 25: `opentack-install` → `pinboard-install`

---

## Phase 4 — Installer (1 file)

### 4.1 `src/installer/index.ts`
- Line 3: JSDoc `OpenTack Installer` → `Pinboard Installer`
- Line 6: Build command `opentack-install` → `pinboard-install`
- Lines 9-14: All JSDoc references `OpenTack` → `Pinboard`
- Line 25: `REPO = "anas1412/opentack"` → `REPO = "anas1412/opencode-pinboard"`
- Line 28: `OPENTACK_DIR` → `PINBOARD_DIR`, `~/opentack` → `~/.pinboard`
- Line 29: `OPENTACK_DATA_DIR` → `PINBOARD_DATA_DIR`, `~/.opentack` → `~/.pinboard`
- Line 234: `installOpenTack()` → `installPinboard()`
- Line 239: `opentack-update` → `pinboard-update`
- Line 254: `Cloning OpenTack` → `Cloning Pinboard`
- Lines 292-293: `OpenTack-dev` → `Pinboard-dev`, `OpenTack` → `Pinboard`
- Line 307: `Name=OpenTack` → `Name=Pinboard`
- Line 313: `StartupWMClass=OpenTack` → `StartupWMClass=Pinboard`
- Line 315: `opentack.desktop` → `pinboard.desktop`
- Line 317: `(OpenTack)` → `(Pinboard)`
- Line 324: `OpenTack Installer` → `Pinboard Installer`
- Line 327: `opentack-install` → `pinboard-install`
- Line 334: `OPENTACK_DIR` → `PINBOARD_DIR`, `~/opentack` → `~/.pinboard`
- Line 335: `OPENTACK_DATA_DIR` → `PINBOARD_DATA_DIR`, `~/.opentack` → `~/.pinboard`
- Line 342: `OpenTack repo` → `Pinboard repo`
- Line 361: `OpenTack — Install` → `Pinboard — Install`
- Line 367: `installOpenTack()` → `installPinboard()`
- Line 369: `OpenTack-dev → OpenTack` → `Pinboard-dev → Pinboard`
- Line 377: `OpenTack` → `Pinboard` (appDir)
- Line 380: `OpenTack.exe` → `Pinboard.exe`
- Line 382: `OpenTack.app` → `Pinboard.app`
- Line 385: `OpenTack is installed!` → `Pinboard is installed!`
- Line 387: `"OpenTack"` → `"Pinboard"`

Also rename the function: `installOpenTack` → `installPinboard`

---

## Phase 5 — Server & Backend Code (7 files)

### 5.1 `src/paths.ts`
- `getOpenTackDataDir()` → `getPinboardDataDir()`
- `OPENTACK_DATA_DIR` → `PINBOARD_DATA_DIR`
- `".opentack"` → `".pinboard"`
- `getOpenTackDbPath()` → `getPinboardDbPath()`
- `OPENTACK_DB_PATH` → `PINBOARD_DB_PATH`
- `getOpenTackReposDir()` → `getPinboardReposDir()`
- `getOpenTackWorktreesDir()` → `getPinboardWorktreesDir()`
- `"opentack-worktrees"` → `"pinboard-worktrees"`
- `getOpenTackInstallDir()` → `getPinboardInstallDir()`
- `OPENTACK_DIR` → `PINBOARD_DIR`
- `"opentack"` → `".pinboard"`
- All JSDoc comments `OpenTack` → `Pinboard`

### 5.2 `src/shared/rpc.ts`
- `OpenTackRPC` type → `PinboardRPC`
- JSDoc comment: `OpenTack's` → `Pinboard's`

### 5.3 `src/shared/opencode-db.ts`
- Comment: `OpenTack's own sessions table` → `Pinboard's own sessions table`
- Comment: `not just OpenTack-tracked ones` → `not just Pinboard-tracked ones`
- Comment: `of OpenTack sessions` → `of Pinboard sessions`

### 5.4 `src/shared/gh-runner.ts`
- `PBKDF2_SALT = "opentack-gh-token-v1"` → `PBKDF2_SALT = "pinboard-gh-token-v1"`
- `hn + "-opentack-key"` → `hn + "-pinboard-key"`

### 5.5 `src/bun/opencode-session.ts`
- JSDoc: `from OpenTack settings` → `from Pinboard settings`

### 5.6 `src/bun/index.ts`
- `import type { OpenTackRPC }` → `import type { PinboardRPC }`
- `OpenTackRPC` → `PinboardRPC`
- `console.log("[opentack]"` → `console.log("[pinboard]"`
- `title: "OpenTack"` → `title: "Pinboard"`
- `console.log("[opentack] Shutting down..."` → `console.log("[pinboard] Shutting down..."`
- `console.error("[opentack] Fatal error:"` → `console.error("[pinboard] Fatal error:"`

### 5.7 `src/bun/handlers/index.ts`
- Imports: `getOpenTackDataDir` → `getPinboardDataDir`, `getOpenTackReposDir` → `getPinboardReposDir`, `getOpenTackWorktreesDir` → `getPinboardWorktreesDir`
- `const OPENTACK_DIR = getOpenTackDataDir()` → `const PINBOARD_DIR = getPinboardDataDir()`
- `const OPENTACK_REPOS_DIR = getOpenTackReposDir()` → `const PINBOARD_REPOS_DIR = getPinboardReposDir()`
- `function getOpenTackDb()` → `function getPinboardDb()`
- All comments: `OpenTack's` → `Pinboard's`, `OpenTack` → `Pinboard`
- `opentack-worktrees` → `pinboard-worktrees`
- GitHub URL: `anas1412/opentack` → `anas1412/opencode-pinboard`
- `opentack-install-linux` / `opentack-install-windows.exe` → `pinboard-install-linux` / `pinboard-install-windows.exe`

### 5.8 `src/server/index.ts`
- JSDoc: `when OpenTack crashed` → `when Pinboard crashed`
- `OpenTack running at` → `Pinboard running at`

### 5.9 `src/server/cli.ts`
- `"Failed to start OpenTack"` → `"Failed to start Pinboard"`

### 5.10 `src/server/routes/cost.ts`
- `getOpenTackWorktreesDir` → `getPinboardWorktreesDir`
- Comments: all `OpenTack` → `Pinboard`

### 5.11 `src/server/routes/worktree.ts`
- `getOpenTackWorktreesDir` → `getPinboardWorktreesDir`

### 5.12 `src/server/routes/repo.ts`
- `getOpenTackReposDir` → `getPinboardReposDir`

---

## Phase 6 — Database (1 file)

### 6.1 `src/db/index.ts`
- `getOpenTackDbPath` → `getPinboardDbPath`

Note: No table schemas reference "opentack" — the DB schema is clean.

---

## Phase 7 — Client / Frontend (4 files)

### 7.1 `src/client/components/Sidebar.tsx`
- Line 90: `OpenTack` display text → `Pinboard`

### 7.2 `src/client/components/Settings.tsx`
- Line 318: `Configure OpenTack` → `Configure Pinboard`

### 7.3 `src/client/api/rpc-client.ts`
- `import type { OpenTackRPC }` → `import type { PinboardRPC }`
- `OpenTackRPC` → `PinboardRPC` (two more references)

### 7.4 `index.html`
- `<title>OpenTack</title>` → `<title>Pinboard</title>`
- `/opentack-logo.svg` → `/pinboard-logo.svg`
- `/opentack-logo.png` → `/pinboard-logo.png`

---

## Phase 8 — Assets & Logo Files (5 files)

### 8.1 Rename asset files
- `public/opentack-logo.svg` → `public/pinboard-logo.svg`
- `public/opentack-logo.png` → `public/pinboard-logo.png`
- `public/opentack_logo.png` → `public/pinboard_logo.png`

### 8.2 Regenerate assets
- `public/OG-preview.png` — has "OpenTack" text baked into the image. Needs to be recreated with "Pinboard" branding.
- `assets/icon.png` — referenced in installer for desktop file icon. May have "OpenTack" text baked in.

---

## Phase 9 — GitHub & CI (1 file)

### 9.1 `.github/workflows/release.yml`
- `name: opentack-install-${{ matrix.os }}` → `name: pinboard-install-${{ matrix.os }}`
- `path: dist/opentack-install*` → `path: dist/pinboard-install*`
- `pattern: opentack-install-*` → `pattern: pinboard-install-*`
- `mv opentack-install opentack-install-linux` → `mv pinboard-install pinboard-install-linux`
- `mv opentack-install.exe opentack-install-windows.exe` → `mv pinboard-install.exe pinboard-install-windows.exe`
- `opentack-install-*` → `pinboard-install-*` (in release files)

### 9.2 GitHub Repo Settings (manual — web UI)
- Rename repo from `opentack` to `opencode-pinboard`
- Update repo description
- Update website URL if set

---

## Phase 10 — External / Domain (post-code)

### 10.1 Domain (if registered)
- `releases.opentack.dev` → `releases.pinboard.dev` (DNS + electrobun config already changed in Phase 2)
- Potential marketing/docs domains: `opentack.dev`, `docs.opentack.dev`

### 10.2 npm Registry
- Unpublish `opentack`? Or keep as deprecated with a note pointing to `opencode-pinboard`
- Publish `opencode-pinboard` to npm

---

## Execution Order

```
Phase 1: README + Docs (5 .md files)
    ↓
Phase 2: Config files (package.json, electrobun.config.ts, drizzle.config.ts)
    ↓
Phase 3: Shell scripts (opentack.sh → pinboard.sh, opentack.bat → pinboard.bat)
    ↓
Phase 4: Installer (src/installer/index.ts)
    ↓
Phase 5: Server backend (paths.ts, rpc.ts, opencode-db.ts, gh-runner.ts, 
         opencode-session.ts, bun/index.ts, handlers/index.ts, server/*.ts)
    ↓
Phase 6: Database (src/db/index.ts)
    ↓
Phase 7: Client/frontend (Sidebar.tsx, Settings.tsx, rpc-client.ts, index.html)
    ↓
Phase 8: Assets (rename logo files, regenerate OG preview + icon)
    ↓
Phase 9: CI (release.yml) + GitHub repo settings
    ↓
Phase 10: External (npm publish, domain changes)
```

Each phase should be validated independently (typecheck, build) before proceeding.

### Validation Commands
After all code changes:
```bash
bun run typecheck    # TypeScript compilation check
bun run build        # Vite + electrobun build
bun test             # Run test suite
```
