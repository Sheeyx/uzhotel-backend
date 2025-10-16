import type { MyContext } from "../types";
import { isAdmin, isUser } from "../roles";
import { openBookingsPage } from "./panel";

/** /bookings command for both admins and users (read-only for users). */
export function registerBookings(bot: import("telegraf").Telegraf<MyContext>) {
  bot.command("bookings", async (ctx) => {
    const allowed = (await isAdmin(ctx.from?.id)) || (await isUser(ctx.from?.id));
    if (!allowed) return void ctx.reply("You are not allowed to view bookings. Ask admin to add you.");
    await openBookingsPage(ctx, 1);
  });
}
