import type { MyContext } from "../types";
import { isAdmin, isUser } from "../roles";

export function registerHelp(bot: import("telegraf").Telegraf<MyContext>) {
  bot.command("help", async (ctx) => {
    if (await isAdmin(ctx.from?.id)) {
      await ctx.replyWithMarkdownV2(
        ["*Admin commands*", "`/panel` – open admin panel", "`/bookings [n]` – latest bookings"].join("\n")
      );
    } else if (await isUser(ctx.from?.id)) {
      await ctx.reply("You can view bookings with /bookings");
    } else {
      await ctx.reply("Not allowed. Please contact admin.");
    }
  });
}
