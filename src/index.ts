// src/index.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { ENV } from "./config";
import { sendBookingEmailNodemailer, BookingEmailPayload } from "./services/mailer";
import { bookingRouter } from "./routes/bookingRoute";
import { bot } from "./bot/bot";

// 🔌 Telegram handlers
import { registerStart } from "./bot/handlers/start";
import { registerHelp } from "./bot/handlers/help";
import { registerPanel } from "./bot/handlers/panel";       // includes bookings pagination
import { registerBookings } from "./bot/handlers/bookings"; // optional /bookings command
import { registerUsers } from "./bot/handlers/users";       // 👥 Users management
import { registerActions } from "./bot/handlers/action";

function validateEnv() {
  const miss: string[] = [];
  if (!ENV.MONGO_URI) miss.push("MONGO_URI");
  if (!ENV.BOT_TOKEN) miss.push("BOT_TOKEN");
  if (!ENV.API_KEY) miss.push("API_KEY");
  if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
}

async function main() {
  validateEnv();

  // 1) Connect Mongo
  await mongoose.connect(ENV.MONGO_URI);
  console.log("✅ MongoDB connected");

  const app = express();
  app.set("trust proxy", 1);

  // 2) Security + performance
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: true, // tighten in prod: ["https://snhotel.uz","https://admin.snhotel.uz"]
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-api-key", "authorization"],
    })
  );
  app.options("*", cors());

  // 3) Parsers + logs
  app.use(express.json({ limit: "512kb" }));
  app.use(morgan("dev"));

  // 4) API key guard
  const API_KEY = ENV.API_KEY || process.env.API_KEY || "";
  function apiKeyGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!API_KEY) return next(); // skip in dev if unset
    const key = req.header("x-api-key");
    if (key !== API_KEY) return res.status(401).json({ ok: false, error: "Unauthorized" });
    next();
  }

  // 5) Routes
  app.use("/api/bot", apiKeyGuard, bookingRouter);

  // ✅ Email route
  app.post("/api/booking/email", apiKeyGuard, async (req, res) => {
    try {
      const body = req.body as BookingEmailPayload & { toEmail?: string };
      if (!body?.roomTitle || !body?.guestName || !body?.phone || !body?.checkin || !body?.checkout) {
        return res.status(400).json({ ok: false, error: "Missing required fields" });
      }

      // ✅ Send email via Nodemailer
      await sendBookingEmailNodemailer(body, body.toEmail);

      res.json({ ok: true, message: "Email sent successfully" });
    } catch (e: any) {
      console.error("Email send error:", e);
      res.status(500).json({ ok: false, error: "Email send failed" });
    }
  });

  // 6) Health check
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // 7) 404 + error handler
  app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  // 8) Start HTTP server
  const port = Number(ENV.PORT || process.env.PORT || 4008);
  const server = app.listen(port, () => console.log(`✅ API listening on :${port}`));
  server.setTimeout(60_000);

  // 9) Register Telegram handlers BEFORE launching bot
  registerStart(bot);
  registerHelp(bot);
  registerPanel(bot);
  registerBookings(bot);
  registerActions(bot);
  registerUsers(bot);

  // 10) Launch Telegram bot
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch();
    console.log("🤖 Bot launched (polling)");
  } catch (err) {
    console.error("❌ bot.launch() failed:", err);
  }

  // 11) Graceful shutdown
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

  // 12) Crash guards
  process.on("unhandledRejection", (r) => console.error("UNHANDLED REJECTION:", r));
  process.on("uncaughtException", (e) => console.error("UNCAUGHT EXCEPTION:", e));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
