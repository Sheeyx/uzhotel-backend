module.exports = {
  apps: [
    {
      name: "booking-bot",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      node_args: ["--enable-source-maps"],
      env: { NODE_ENV: "development" },
      env_production: { NODE_ENV: "production" }
    }
  ]
};
