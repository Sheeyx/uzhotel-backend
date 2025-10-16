#!/usr/bin/env bash
# ===============================================
# Booking Bot Deploy Script (robust branch logic)
# ===============================================

set -e  # portable (no pipefail to avoid /bin/sh issues)

# ----- EDIT THESE -----
REPO_URL="https://github.com/Sheeyx/snhotel.git"
REPO_DIR="/var/www/booking-bot"         # change to your actual location
BRANCH_PREFERRED="master"               # your target branch; script will fallback if missing
PM2_ECOSYSTEM="process.config.js"       # if absent, starts dist/index.js directly
APP_NAME_PROD="booking-bot:prod"
APP_NAME_DEV="booking-bot:dev"
PORT="${PORT:-4008}"                    # health check port
# ----------------------

GREEN="\033[1;32m"; YELLOW="\033[1;33m"; CYAN="\033[1;36m"; RED="\033[1;31m"; RESET="\033[0m"

ensure_dir_and_repo() {
  echo -e "${CYAN}📂 Ensuring project directory: ${REPO_DIR}${RESET}"
  if [ ! -d "$REPO_DIR" ]; then
    sudo mkdir -p "$REPO_DIR"
    sudo chown "$USER:$USER" "$REPO_DIR"
  fi
  cd "$REPO_DIR"

  if [ ! -d ".git" ]; then
    echo -e "${CYAN}🧬 Cloning repository…${RESET}"
    git clone "$REPO_URL" .
  else
    echo -e "${CYAN}🔗 Checking remote 'origin'…${RESET}"
    if git remote get-url origin >/dev/null 2>&1; then
      CUR="$(git remote get-url origin)"
      if [ "$CUR" != "$REPO_URL" ]; then
        echo -e "${YELLOW}⚠️ Resetting origin to ${REPO_URL}${RESET}"
        git remote set-url origin "$REPO_URL"
      fi
    else
      git remote add origin "$REPO_URL"
    fi
  fi
}

detect_remote_default_branch() {
  # Detect remote HEAD branch (e.g., main)
  git remote show origin | awk -F': ' '/HEAD branch/ {print $2}'
}

checkout_and_pull() {
  local TARGET="$1"

  echo -e "${CYAN}🔄 Fetching origin…${RESET}"
  git fetch origin --prune

  # If preferred branch exists locally, use it
  if git show-ref --verify --quiet "refs/heads/$TARGET"; then
    git checkout "$TARGET"
  # Else if it exists on remote, create local tracking branch
  elif git show-ref --verify --quiet "refs/remotes/origin/$TARGET"; then
    git checkout -b "$TARGET" "origin/$TARGET"
  else
    # Fallback to remote default (HEAD) if preferred is missing
    local DEFAULT_HEAD
    DEFAULT_HEAD="$(detect_remote_default_branch)"

    if [ -z "$DEFAULT_HEAD" ]; then
      echo -e "${RED}❌ Remote has no default HEAD. The repo might be EMPTY (no commits).${RESET}"
      echo -e "${YELLOW}👉 Fix: create an initial commit locally and push it:"
      echo "   git checkout -b ${TARGET}"
      echo "   echo '# snhotel' > README.md && git add README.md && git commit -m 'chore: initial commit'"
      echo "   git push -u origin ${TARGET}"
      exit 1
    fi

    echo -e "${YELLOW}ℹ️ Branch '${TARGET}' not found. Using remote default: '${DEFAULT_HEAD}'${RESET}"
    if git show-ref --verify --quiet "refs/heads/$DEFAULT_HEAD"; then
      git checkout "$DEFAULT_HEAD"
    else
      git checkout -b "$DEFAULT_HEAD" "origin/$DEFAULT_HEAD"
    fi
  fi

  echo -e "${CYAN}⬇️ Pulling latest commits…${RESET}"
  git reset --hard
  git pull --ff-only origin "$(git branch --show-current)"
}

install_and_build() {
  echo -e "${CYAN}📦 Installing dependencies…${RESET}"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi

  echo -e "${CYAN}🏗️ Building project…${RESET}"
  npm run build
}

pm2_start() {
  local ENV="$1"
  local NAME="$2"

  # Export common envs so PM2 sees them (or define in ecosystem file)
  export NODE_ENV="$ENV"
  export PORT="$PORT"
  # export MONGO_URI="$MONGO_URI"
  # export BOT_TOKEN="$BOT_TOKEN"
  # export API_KEY="$API_KEY"

  echo -e "${CYAN}🚀 Starting via PM2 (${ENV})…${RESET}"
  if [ -f "$PM2_ECOSYSTEM" ]; then
    # Start/reload by ecosystem
    if pm2 describe "$NAME" >/dev/null 2>&1; then
      pm2 reload "$PM2_ECOSYSTEM" --env "$ENV"
    else
      pm2 start "$PM2_ECOSYSTEM" --env "$ENV"
    fi
  else
    # Direct entry
    if pm2 describe "$NAME" >/dev/null 2>&1; then
      pm2 restart "$NAME" --update-env
    else
      pm2 start dist/index.js --name "$NAME" --update-env
    fi
  fi

  pm2 save
  pm2 startup -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true
}

health_check() {
  echo -e "${CYAN}🌐 Health check http://localhost:${PORT}/health …${RESET}"
  if curl -fsS "http://localhost:${PORT}/health" >/dev/null; then
    echo -e "${GREEN}🟢 Health OK${RESET}"
  else
    echo -e "${YELLOW}⚠️ Health endpoint failed (check pm2 logs)${RESET}"
  fi
}

deploy() {
  local ENV="$1"
  local NAME="$2"

  ensure_dir_and_repo
  checkout_and_pull "$BRANCH_PREFERRED"
  install_and_build
  pm2_start "$ENV" "$NAME"
  health_check
  echo -e "${GREEN}✅ Deployment complete: ${NAME} (${ENV})${RESET}"
}

# ---------- ENTRY ----------
MODE="${1:-prod}"

case "$MODE" in
  prod|production)
    echo -e "${GREEN}🚀 Deploying PRODUCTION (prefers '${BRANCH_PREFERRED}', falls back to remote default)…${RESET}"
    deploy "production" "$APP_NAME_PROD"
    ;;
  dev|development)
    echo -e "${YELLOW}🧪 Deploying DEVELOPMENT (prefers '${BRANCH_PREFERRED}', falls back to remote default)…${RESET}"
    deploy "development" "$APP_NAME_DEV"
    ;;
  *)
    echo -e "${RED}Usage:${RESET} $0 [prod|dev]"
    exit 1
    ;;
esac

echo -e "${CYAN}📜 PM2 apps:${RESET}"
pm2 ls
