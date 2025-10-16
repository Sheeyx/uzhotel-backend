set -e

# --- PRODUCTION ---
git reset --hard
git checkout master
git pull --ff-only origin master

if [ -f package-lock.json ]; then
  npm ci
else
  npm i
fi

npm run build

# If you named PM2 file 'process.config.cjs' (recommended for ESM):
# pm2 start process.config.cjs --env production
# Else (CJS project) keep .js:
pm2 start process.config.cjs --env development


# If already started previously, prefer reload:
# pm2 reload process.config.cjs --env production

pm2 save
# pm2 startup  # run once on a new server
