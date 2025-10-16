import { Telegraf, session, type MiddlewareFn } from "telegraf";
import { ENV } from "../config";
import type { BotSession, MyContext } from "./types";

export const bot = new Telegraf<MyContext>(ENV.BOT_TOKEN);

// Telegraf session (typed)
const sessionMw = session<BotSession,MyContext>({
  defaultSession: () => ({ mode: null }),
}) as unknown as MiddlewareFn<MyContext>;

bot.use(sessionMw);
