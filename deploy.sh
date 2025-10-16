#!/usr/bin/env bash
# ===============================================
# Booking Bot Deploy Script (master branch)
# Author: Shekhrozbek Muydinov
# ===============================================

set -e

# -------- CONFIG --------
REPO_URL="https://github.com/Sheeyx/snhotel.git"
REPO_DIR="/var/www/booking-bot"          # change this to your actual project folder
BRANCH_PROD="master"                     # <-- uses master branch
BRANCH_DEV="develop"
PM2_ECOSYSTEM="process.config.js"
APP_NAME_PROD="booking-bot:prod"
APP_NAME_DEV="booking-bot:dev"
PORT="${PORT:-4008}"                     # default port
# ------------------------

GREEN="\033[1;32m"; YELLOW="\033[1;33m"; CYAN="\033[1;36m"; RED="\033[1;31m"; RESET="\033[0m"

ensure_dir_and_repo() {
  echo -e "${CYAN}📂 Checking project directory: $REPO_DIR${RESET}"
  if [ ! -d "$REPO_DIR" ]; then
    sudo mkdir -p "$REPO_DIR"
    sudo chown "$USER:$USER" "$REPO_DIR"
  fi

  cd "$REPO_DIR"

  if [ ! -d ".git" ]; then
    echo -e "${CYAN}🧬 Cloning repository into $REPO_DIR${RESET}"
    git clone "$REPO_URL" .
  else
    echo -e "${CYAN}🔗 Ensuring remote 'origin' is correct${RESET}"
    if git remote get-url origin >/dev/null 2>&1; then
      CURRENT_URL="$(git remote get-url origin)"
      if [ "$CURRENT_URL" != "$REPO_URL" ]; then
        echo -e "${YELLOW}⚠️ Resetting remote to $REPO_URL${RESET}"
        git remote set-url origin "$REPO_URL"
      fi
    else
      git remote add origin "$REPO_URL"
    fi
  fi
}

checkout_and_pull() {
  local BR="$1"
  echo -e "${CYAN}🔄 Checking out branch: $BR${RESET}"
  git fetch origin
  if git show-ref --verify --quiet "refs/heads/$BR"; then
    git checkout "$BR"
  else
    git checkout -b "$BR" "origin/$BR"
  fi
  echo -e "${CYAN}⬇️ Pulling latest from origin/${BR}${RESET}"
  git reset --hard
  git pull --ff-only origin "$BR"
}

install_and_build() {
  echo -e "${CYAN}📦 Installing dependencies...${RESET}"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi

  echo -e "${CYAN}🏗️ Building project...${RESET}"
  npm run build
}

pm2_start() {
  local ENV="$1"
  local NAME="$2"

  export NODE_ENV="$ENV"
  export PORT="$PORT"

  echo -e "${CYAN}🚀 Starting app with PM2 (${ENV})...${RESET}"
  if [ -f "$PM2_ECOSYSTEM" ]; then
    pm2 start "$PM2_ECOSYSTEM" --env "$ENV"
  else
    pm2 start dist/index.js --name "$NAME" --update-env
  fi

  pm2 save
  pm2 restart all
}

health_check() {
  echo -e "${CYAN}🌐 Health check: http://localhost:${PORT}/health${RESET}"
  if curl -fsS "http://localhost:${PORT}/health" >/dev/null; then
    echo -e "${GREEN}🟢 Health OK${RESET}"
  else
    echo -e "${YELLOW}⚠️ Health check failed (check pm2 logs)${RESET}"
  fi
}

deploy() {
  local BRANCH="$1"
  local ENV="$2"
  local NAME="$3"

  ensure_dir_and_repo
  checkout_and_pull "$BRANCH"
  install_and_build
  pm2_start "$ENV" "$NAME"
  health_check
  echo -e "${GREEN}✅ Deployment complete: $NAME (${ENV})${RESET}"
}

# ---- ENTRY ----
MODE="${1:-prod}"

if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
  echo -e "${GREEN}🚀 Deploying PRODUCTION (branch: ${BRANCH_PROD})${RESET}"
  deploy "$BRANCH_PROD" "production" "$APP_NAME_PROD"
elif [ "$MODE" = "dev" ] || [ "$MODE" = "development" ]; then
  echo -e "${YELLOW}🧪 Deploying DEVELOPMENT (branch: ${BRANCH_DEV})${RESET}"
  deploy "$BRANCH_DEV" "development" "$APP_NAME_DEV"
else
  echo -e "${RED}Usage:${RESET} $0 [prod|dev]"
  exit 1
fi

echo -e "${CYAN}📜 PM2 processes:${RESET}"
pm2 ls
