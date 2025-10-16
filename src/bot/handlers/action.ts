import dayjs from "dayjs";
import { Booking } from "../../models/Booking";
import type { BookingDoc } from "../../models/Booking";
import type { MyContext } from "../types";
import { isAdmin, isUser } from "../roles";
import { buildBookingHtml } from "../sender"; // ⬅️ use the same HTML builder

export function registerActions(bot: import("telegraf").Telegraf<MyContext>) {
  // ... other actions ...

  bot.action(/view:(.+)/, async (ctx) => {
    const canView = (await isAdmin(ctx.from?.id)) || (await isUser(ctx.from?.id));
    if (!canView) return;

    const id = ctx.match?.[1];
    if (!id) return void ctx.answerCbQuery("Bad payload");
    const b = await Booking.findById(id).lean<BookingDoc | null>();
    if (!b) return void ctx.answerCbQuery("Not found");
    await ctx.answerCbQuery();

    const created = dayjs(b.createdAt).format("YYYY-MM-DD HH:mm");
    const html =
      buildBookingHtml(b) +
      `\n• <b>Status:</b> ${b.status ? String(b.status) : "—"}` +
      `\n• <b>Created:</b> ${created}`;

    await ctx.reply(html, { parse_mode: "HTML" });
  });

  // ... other actions ...
}
