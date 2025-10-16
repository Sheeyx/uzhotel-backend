module.exports = {
  apps: [
    {
      name: "booking-bot",
      script: "dist/index.js", // after build
      instances: 1,            // or "max" for all CPU cores
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",

      // Use dotenv via config.ts
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
