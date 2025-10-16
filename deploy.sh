#!/usr/bin/env bash
# ===============================================
# Booking Bot Deployment Script
# Author: Shekhrozbek Muydinov
# ===============================================

set -e  # Stop on first error

# ===== CONFIG =====
REPO_DIR="/var/www/booking-bot"      # change this to your project path
BRANCH_PROD="main"                   # or "master" if your repo uses master
BRANCH_DEV="develop"
PM2_ECOSYSTEM="process.config.js"    # pm2 config file if you have one
PORT="${PORT:-4008}"                 # default port if not set

# ===== COLORS =====
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
CYAN="\033[1;36m"
RESET="\033[0m"

# ===== FUNCTIONS =====
deploy_branch() {
  local BRANCH="$1"
  local ENV="$2"
  local NAME="$3"

  echo -e "${CYAN}🔄 Switching to project directory...${RESET}"
  cd "$REPO_DIR"

  echo -e "${CYAN}📦 Pulling latest code from branch '$BRANCH'...${RESET}"
  git reset --hard
  git checkout "$BRANCH"
  git pull origin "$BRANCH"

  echo -e "${CYAN}📥 Installing dependencies...${RESET}"
  npm install

  echo -e "${CYAN}🏗️  Building project...${RESET}"
  npm run build

  # Export environment variables for PM2
  export NODE_ENV="$ENV"
  export PORT="$PORT"
  export MONGO_URI="$MONGO_URI"
  export BOT_TOKEN="$BOT_TOKEN"
  export API_KEY="$API_KEY"

  echo -e "${CYAN}🚀 Starting with PM2...${RESET}"
  if [ -f "$PM2_ECOSYSTEM" ]; then
    pm2 start "$PM2_ECOSYSTEM" --env "$ENV"
  else
    pm2 start dist/index.js --name "$NAME" --update-env
  fi

  echo -e "${GREEN}✅ Deployment successful ($ENV)!${RESET}"
  pm2 save
  pm2 restart all

  echo -e "${CYAN}🌐 Checking health endpoint...${RESET}"
  curl -fsS "http://localhost:${PORT}/health" && echo -e "\n${GREEN}🟢 Health OK${RESET}" || echo -e "\n${YELLOW}⚠️ Health check failed${RESET}"
}

# ===== MAIN =====
MODE="${1:-prod}"

if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
  echo -e "${GREEN}🚀 Deploying PRODUCTION branch '$BRANCH_PROD'...${RESET}"
  deploy_branch "$BRANCH_PROD" "production" "booking-bot:prod"
elif [ "$MODE" = "dev" ] || [ "$MODE" = "development" ]; then
  echo -e "${YELLOW}🧪 Deploying DEVELOPMENT branch '$BRANCH_DEV'...${RESET}"
  deploy_branch "$BRANCH_DEV" "development" "booking-bot:dev"
else
  echo "Usage: ./deploy.sh [prod|dev]"
  exit 1
fi

echo -e "${CYAN}📜 PM2 list:${RESET}"
pm2 ls
