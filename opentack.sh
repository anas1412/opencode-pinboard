#!/usr/bin/env bash
set -euo pipefail

REPO="anas1412/opentack"
BRANCH="main"
INSTALL_DIR="${OPENTACK_DIR:-$HOME/opentack}"
DATA_DIR="${OPENTACK_DATA_DIR:-$HOME/.opentack}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[info]${NC} $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
err()   { echo -e "${RED}[err]${NC}  $1"; }

# ── Dependency checks ──────────────────────────────────────────────

check_deps() {
  local missing=false

  if ! command -v bun &>/dev/null; then
    warn "bun is not installed."
    echo "  Install it: curl -fsSL https://bun.sh/install | bash"
    missing=true
  else
    ok "bun $(bun --version)"
  fi

  if ! command -v opencode &>/dev/null; then
    warn "opencode is not installed."
    echo "  Install it: curl -fsSL https://opencode.ai/install | bash"
    echo "  Or via npm: npm install -g @opencode-ai/cli"
    missing=true
  else
    ok "opencode $(opencode --version 2>/dev/null || echo 'found')"
  fi

  if ! command -v git &>/dev/null; then
    err "git is not installed. Install it and try again."
    missing=true
  fi

  if [ "$missing" = true ]; then
    echo ""
    echo "  Install missing dependencies, then re-run:"
    echo "    curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/opentack.sh | bash"
    exit 1
  fi
}

# ── Install ────────────────────────────────────────────────────────

cmd_install() {
  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║         OpenTrack — Install              ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo ""

  check_deps

  if [ -d "$INSTALL_DIR" ]; then
    warn "$INSTALL_DIR already exists."
    echo "  To update instead, run: $0 update"
    echo "  To reinstall, remove it first: rm -rf $INSTALL_DIR"
    exit 1
  fi

  info "Cloning OpenTrack..."
  git clone --depth=1 --branch "$BRANCH" "https://github.com/$REPO.git" "$INSTALL_DIR"
  ok "Cloned to $INSTALL_DIR"

  cd "$INSTALL_DIR"

  info "Installing dependencies..."
  bun install
  ok "Dependencies installed"

  info "Running database migrations..."
  mkdir -p "$DATA_DIR"
  bun run db:migrate
  ok "Database ready"

  info "Setting default opencode theme..."
  TUI_DIR="$HOME/.config/opencode"
  mkdir -p "$TUI_DIR"
  cat > "$TUI_DIR/tui.json" <<- EOF
{
  "\$schema": "https://opencode.ai/tui.json",
  "theme": "opencode"
}
EOF
  ok "Default opencode theme set to 'opencode'"

  info "Building frontend..."
  bun run build
  ok "Build complete"

  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║         OpenTrack is installed!          ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo ""
  echo "  Run it:"
  echo "    cd $INSTALL_DIR && bun run dev"
  echo ""
  echo "  Then open http://localhost:3000 in your browser."
  echo ""
}

# ── Update ─────────────────────────────────────────────────────────

cmd_update() {
  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║         OpenTrack — Update               ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo ""

  if [ ! -d "$INSTALL_DIR/.git" ]; then
    err "No OpenTrack installation found at $INSTALL_DIR."
    echo "  Install it first: curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/opentack.sh | bash"
    exit 1
  fi

  cd "$INSTALL_DIR"

  info "Pulling latest changes..."
  git pull
  ok "Up to date"

  info "Updating dependencies..."
  bun install
  ok "Dependencies updated"

  info "Running database migrations..."
  bun run db:migrate
  ok "Database up to date"

  info "Ensuring default opencode theme..."
  TUI_DIR="$HOME/.config/opencode"
  mkdir -p "$TUI_DIR"
  if [ ! -f "$TUI_DIR/tui.json" ]; then
    cat > "$TUI_DIR/tui.json" <<- EOF
{
  "\$schema": "https://opencode.ai/tui.json",
  "theme": "opencode"
}
EOF
    ok "Default opencode theme set to 'opencode'"
  else
    ok "OpenCode theme config already exists (skipped)"
  fi

  info "Rebuilding frontend..."
  bun run build
  ok "Rebuild complete"

  echo ""
  echo "  OpenTrack is up to date!"  
  echo ""
}

# ── Uninstall ──────────────────────────────────────────────────────

cmd_uninstall() {
  echo ""
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║         OpenTrack — Uninstall            ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo ""

  if [ -d "$INSTALL_DIR" ]; then
    info "Removing $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    ok "Application removed"
  else
    warn "No installation found at $INSTALL_DIR"
  fi

  if [ -d "$DATA_DIR" ]; then
    info "Removing data directory $DATA_DIR..."
    rm -rf "$DATA_DIR"
    ok "Data removed"
  else
    warn "No data directory found at $DATA_DIR"
  fi

  echo ""
  ok "OpenTrack has been uninstalled."
  echo "  bun and opencode were kept — remove them manually if desired."
  echo ""
}

# ── Help ───────────────────────────────────────────────────────────

cmd_help() {
  echo "OpenTrack — local ticket-based workspace for opencode"
  echo ""
  echo "Usage: $0 <command>"
  echo ""
  echo "Commands:"
  echo "  install     Install OpenTrack and its dependencies"
  echo "  update      Pull latest version and rebuild"
  echo "  uninstall   Remove OpenTrack (keeps bun and opencode)"
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────

case "${1:-install}" in
  install)   cmd_install ;;
  update)    cmd_update ;;
  uninstall) cmd_uninstall ;;
  help|--help|-h) cmd_help ;;
  *) err "Unknown command: $1"; echo ""; cmd_help; exit 1 ;;
esac
