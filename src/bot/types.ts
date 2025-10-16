import { Context } from "telegraf";

/** Session is ALWAYS present on ctx (we install session middleware), and mode is required (null by default). */
export type BotSession = {
  mode: "await_add_user" | null;
};

export type MyContext = Context & { session: BotSession };
