// src/index.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { ENV } from "./config.js";
import {
  sendBookingEmailNodemailer,
  BookingEmailPayload,
} from "./services/mailer";
import { bookingRouter } from "./routes/bookingRoute";
import { bot } from "./bot/bot";

// 🔌 Telegram handlers
import { registerStart } from "./bot/handlers/start";
import { registerHelp } from "./bot/handlers/help";
import { registerPanel } from "./bot/handlers/panel";
import { registerBookings } from "./bot/handlers/bookings";
import { registerUsers } from "./bot/handlers/users";
import { registerActions } from "./bot/handlers/action";

// ================================
// ENV VALIDATION
// ================================
function validateEnv() {
  const miss: string[] = [];
  if (!ENV.MONGO_URI) miss.push("MONGO_URI");
  if (!ENV.BOT_TOKEN) miss.push("BOT_TOKEN");
  if (!ENV.API_KEY) miss.push("API_KEY");
  if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
}

// ================================
// ALLOWED ORIGINS (DEV + PROD)
// ================================
const allowedOrigins = [
  "http://localhost:3003",
  "https://snhotel.uz",
  "https://snhotel.uz/api",
  "https://www.snhotel.uz/api",
  "https://www.snhotel.uz",
  "https://admin.snhotel.uz",
];

// ================================
// MAIN FUNCTION
// ================================
async function main() {
  validateEnv();

  // Mongo connection
  await mongoose.connect(ENV.MONGO_URI);
  console.log("✅ MongoDB connected");

  const app = express();
  app.set("trust proxy", 1);

  // ================================
  // SECURITY LAYERS
  // ================================
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // ================================
  // CORS WITH WHITELIST
  // ================================
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Postman / mobile / server

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS: " + origin));
      },
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-api-key", "authorization"],
    })
  );
  app.options("*", cors());

  // ================================
  // PARSERS + LOGS
  // ================================
  app.use(express.json({ limit: "512kb" }));
  app.use(morgan("dev"));

  // ================================
  // API KEY GUARD
  // ================================
  const API_KEY = ENV.API_KEY || process.env.API_KEY || "";
  function apiKeyGuard(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (!API_KEY) return next(); // disable in dev
    const key = req.header("x-api-key");
    if (key !== API_KEY)
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    next();
  }

  // ================================
  // ROUTES
  // ================================
  app.use("/", apiKeyGuard, bookingRouter);

  // EMAIL ROUTE
  app.post("/booking/email", apiKeyGuard, async (req, res) => {
    try {
      const body = req.body as BookingEmailPayload & { toEmail?: string };

      if (
        !body?.roomTitle ||
        !body?.guestName ||
        !body?.phone ||
        !body?.checkin ||
        !body?.checkout
      ) {
        return res.status(400).json({ ok: false, error: "Missing fields" });
      }

      await sendBookingEmailNodemailer(body, body.toEmail);

      res.json({ ok: true, message: "Email sent successfully" });
    } catch (e) {
      console.error("Email send error:", e);
      res.status(500).json({ ok: false, error: "Email send failed" });
    }
  });

  // HEALTH CHECK
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // ================================
  // 404 + ERROR HANDLERS
  // ================================
  app.use((req, res) =>
    res.status(404).json({ ok: false, error: "Not found" })
  );

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("Unhandled error:", err);
      res.status(500).json({ ok: false, error: "Internal server error" });
    }
  );

  // ================================
  // SERVER START
  // ================================
  const port = Number(ENV.PORT || process.env.PORT || 4008);
  const server = app.listen(port, () =>
    console.log(`🚀 API running on port ${port}`)
  );
  server.setTimeout(60000);

  // ================================
  // TELEGRAM BOT REGISTRATION
  // ================================
  registerStart(bot);
  registerHelp(bot);
  registerPanel(bot);
  registerBookings(bot);
  registerActions(bot);
  registerUsers(bot);

  // BOT LAUNCH
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch();
    console.log("🤖 Telegram bot launched (polling)");
  } catch (err) {
    console.error("❌ bot.launch() failed:", err);
  }

  // ================================
  // GRACEFUL SHUTDOWN
  // ================================
  async function shutdown(signal: string) {
    try {
      console.log(`\n${signal} received. Shutting down…`);
      await bot.stop(signal);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await mongoose.disconnect();
      console.log("👋 Clean exit");
      process.exit(0);
    } catch (e) {
      console.error("Shutdown error:", e);
      process.exit(1);
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Crash protection
  process.on("unhandledRejection", (r) =>
    console.error("UNHANDLED REJECTION:", r)
  );
  process.on("uncaughtException", (e) =>
    console.error("UNCAUGHT EXCEPTION:", e)
  );
}

// MAIN START
main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
