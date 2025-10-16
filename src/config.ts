import "dotenv/config";

function splitIds(s?: string): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export interface AppEnv {
  BOT_TOKEN: string;
  MONGO_URI: string;
  PORT: number;
  ADMIN_CHAT_IDS: string[];
  TG_ADMIN_IDS: string[];
  API_KEY: string;
  ADMIN_HTTP_SECRET: string;
}

export const ENV: AppEnv = {
  BOT_TOKEN: process.env.BOT_TOKEN ?? "",
  MONGO_URI: process.env.MONGO_URI ?? "",
  PORT: Number(process.env.PORT ?? "4008"),
  ADMIN_CHAT_IDS: splitIds(process.env.ADMIN_CHAT_IDS),
  TG_ADMIN_IDS: splitIds(process.env.TG_ADMIN_IDS),
  API_KEY: process.env.API_KEY ?? "",
  ADMIN_HTTP_SECRET: process.env.ADMIN_HTTP_SECRET ?? "",
};

(function assertEnv(e: AppEnv) {
  const missing: string[] = [];
  if (!e.BOT_TOKEN) missing.push("BOT_TOKEN");
  if (!e.MONGO_URI) missing.push("MONGO_URI");
  if (!e.API_KEY) missing.push("API_KEY");
  if (!e.ADMIN_HTTP_SECRET) missing.push("ADMIN_HTTP_SECRET");
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
})(ENV);
