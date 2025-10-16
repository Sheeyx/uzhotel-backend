import { Markup } from "telegraf";
import type { MyContext } from "../types";
import { isAdmin, isUser } from "../roles";
import { adminPanelKeyboard } from "../keyboards";
import { Booking, type BookingDoc } from "../../models/Booking";
import { sendBookingCard } from "../sender";

const PAGE_SIZE = 10;

// ─── Internal: fetch a page ─────────────────────────────────────────────
async function getBookingsPage(page: number) {
  const total = await Booking.countDocuments();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const items = await Booking.find()
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean<BookingDoc[]>();

  return { items, total, page: safePage, totalPages };
}

// ─── Internal: paginator UI ─────────────────────────────────────────────
function paginatorKeyboard(page: number, totalPages: number) {
  const prev = page > 1 ? Markup.button.callback("◀ Prev", `bookings:page:${page - 1}`) : Markup.button.callback("·", "noop");
  const next = page < totalPages ? Markup.button.callback("Next ▶", `bookings:page:${page + 1}`) : Markup.button.callback("·", "noop");

  return Markup.inlineKeyboard([
    [prev, Markup.button.callback(`Page ${page}/${totalPages}`, "noop"), next],
    [Markup.button.callback("🔄 Refresh", `bookings:page:${page}`), Markup.button.callback("⬅️ Back", "panel:back")],
  ]);
}

// We track all messages (10 cards + paginator) to delete them before next page
const lastMessages = new Map<string, number[]>();

async function cleanPrevious(chatId: number, ctx: MyContext) {
  const key = String(chatId);
  const ids = lastMessages.get(key) ?? [];
  if (!ids.length) return;
  await Promise.allSettled(ids.map((mid) => ctx.telegram.deleteMessage(chatId, mid).catch(() => {})));
  lastMessages.set(key, []);
}

/**
 * ✅ Exported helper: open bookings page with cleanup
 * Use this everywhere (inline button, /bookings, reply-keyboard).
 */
export async function openBookingsPage(ctx: MyContext, pageReq = 1) {
  const admin = await isAdmin(ctx.from?.id);
  const canView = admin || (await isUser(ctx.from?.id));
  if (!canView) {
    await ctx.reply("You are not allowed to view bookings. Ask admin to add you.");
    return;
  }

  const chatId = ctx.chat?.id;
  if (chatId == null) return;

  const { items, total, page, totalPages } = await getBookingsPage(pageReq);

  // 1) Clean old set
  await cleanPrevious(chatId as number, ctx);

  // 2) Send current 10 cards (buttons only for admins)
  const sent: number[] = [];
  for (const b of items) {
    const msg = await sendBookingCard(chatId, b, admin, true);
    sent.push(msg.message_id);
  }

  // 3) Send paginator summary
  const paginator = await ctx.reply(
    `📚 Total bookings: ${total}\n📄 Page ${page}/${totalPages} (${PAGE_SIZE} per page)`,
    paginatorKeyboard(page, totalPages)
  );
  sent.push(paginator.message_id);

  // 4) Save for next cleanup
  lastMessages.set(String(chatId), sent);
}

/**
 * Registers inline panel actions (admin panel entry + pagination).
 * Users with role "user" can view bookings; admins also see panel buttons.
 */
export function registerPanel(bot: import("telegraf").Telegraf<MyContext>) {
  // Admin panel entry
  bot.command("panel", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) return;
    await ctx.reply("🛠 Admin Panel", adminPanelKeyboard());
  });

  // Inline “📚 View bookings”
  bot.action("panel:bookings", async (ctx) => {
    await ctx.answerCbQuery();
    await openBookingsPage(ctx, 1);
  });

  // Prev / Next / Refresh
  bot.action(/bookings:page:(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = Number(ctx.match?.[1]) || 1;
    await openBookingsPage(ctx, page);
  });

  // Back (also clean leftovers)
  bot.action("panel:back", async (ctx) => {
    await ctx.answerCbQuery();
    if (!(await isAdmin(ctx.from?.id))) return;
    const chatId = ctx.chat?.id;
    if (chatId != null) await cleanPrevious(chatId as number, ctx);
    await ctx.reply("🛠 Admin Panel", adminPanelKeyboard());
  });

  bot.action("noop", async (ctx) => ctx.answerCbQuery().catch(() => {}));
}
