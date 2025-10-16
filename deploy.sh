#!/bin/bash
set -euo pipefail

# ========= CONFIG =========
REPO_DIR="/var/www/booking-bot"      # <— change to your project path
BRANCH_PROD="main"                   # or "master" if your repo uses master
BRANCH_DEV="develop"                 # your dev branch name (optional)
PM2_ECOSYSTEM="process.config.js"    # pm2 ecosystem file (fallback to dist/index.js if missing)

# Environment sanity checks (customize as needed)
: "${MONGO_URI:?MONGO_URI is required}"
: "${BOT_TOKEN:?BOT_TOKEN is required}"
: "${API_KEY:?API_KEY is required}"
PORT="${PORT:-4008}"                 # default 4008 if not set

# ========= FUNCTIONS =========
deploy_branch () {
  local BR="$1"
  local ENV="$2"    # production|development
  local PM2_NAME="$3"

  echo "==> Switching to $REPO_DIR"
  cd "$REPO_DIR"

  echo "==> Resetting local changes"
  git reset --hard

  echo "==> Checking out branch: $BR"
  git checkout "$BR"

  echo "==> Pulling latest from origin/$BR"
  git pull origin "$BR"

  echo "==> Installing dependencies"
  npm i

  echo "==> Building project"
  npm run build

  # Export env for this session so pm2 picks them up (good for fallback mode)
  export NODE_ENV="$ENV"
  export PORT="$PORT"
  export MONGO_URI="$MONGO_URI"
  export BOT_TOKEN="$BOT_TOKEN"
  export API_KEY="$API_KEY"

  if [ -f "$PM2_ECOSYSTEM" ]; then
    echo "==> Starting with PM2 ecosystem ($PM2_ECOSYSTEM) in $ENV"
    pm2 start "$PM2_ECOSYSTEM" --env "$ENV"
  else
    echo "==> Ecosystem not found; starting dist/index.js directly"
    pm2 start dist/index.js \
      --name "$PM2_NAME" \
      --update-env
  fi

  echo "==> Enabling PM2 startup + saving process list"
  pm2 save
  pm2 startup -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true

  echo "==> Done: $PM2_NAME ($ENV)"
}

# ========= ENTRYPOINT =========
# Usage:
#   ./deploy.sh prod
#   ./deploy.sh dev
# If no arg given, default to prod.

MODE="${1:-prod}"

if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
  echo "🚀 Deploying PRODUCTION (branch: $BRANCH_PROD)"
  deploy_branch "$BRANCH_PROD" "production" "booking-bot:prod"
elif [ "$MODE" = "dev" ] || [ "$MODE" = "development" ]; then
  echo "🧪 Deploying DEVELOPMENT (branch: $BRANCH_DEV)"
  # For dev, you can run ts-node or nodemon via PM2 if you prefer:
  # pm2 start "npm run start:dev" --name "booking-bot:dev"
  deploy_branch "$BRANCH_DEV" "development" "booking-bot:dev"
else
  echo "Usage: $0 [prod|dev]"
  exit 1
fi

echo "✅ PM2 list:"
pm2 ls

# Optional: quick health check (adjust URL if behind a proxy)
echo "🔎 Hitting health endpoint: http://localhost:${PORT}/health"
curl -fsS "http://localhost:${PORT}/health" && echo -e "\n🟢 Health OK" || echo -e "\n⚠️ Health endpoint failed (check logs)"

echo "📜 Logs: pm2 logs (Ctrl+C to exit)"
# pm2 logs   # uncomment if you want to tail logs automatically
