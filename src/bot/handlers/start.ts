// src/bot/handlers/start.ts
import { Markup } from "telegraf";
import type { MyContext } from "../types";
import { isAdmin, isUser, ensureEnvAdminsSeeded } from "../roles";
import { adminPanelKeyboard } from "../keyboards";
import { UserRole } from "../../models/userRole";
import { UserProfile } from "../../models/UserProfile";
import { mainReplyKeyboard, REPLY_BTN } from "../replyKeyboard";
import { openBookingsPage } from "./panel";

/**
 * /start:
 *  - Seeds env admins
 *  - Saves/updates UserProfile
 *  - Auto-creates UserRole { role: "user" } if none exists
 *  - Shows Admin Panel or User menu accordingly
 * /id helper echoes numeric IDs
 * Reply-keyboard buttons: View bookings / Users / Help
 */
export function registerStart(bot: import("telegraf").Telegraf<MyContext>) {
  // Handy: show numeric IDs
  bot.command("id", async (ctx) => {
    await ctx.reply(`from.id = ${ctx.from?.id}\nchat.id = ${ctx.chat?.id}`);
  });

  bot.start(async (ctx) => {
    try {
      // 1) Make sure env-defined admins are seeded
      await ensureEnvAdminsSeeded();

      const uid = String(ctx.from?.id || "");
      const firstName = ctx.from?.first_name || null;
      const lastName = ctx.from?.last_name || null;
      const usernameRaw = ctx.from?.username || null; // original case (for display)
      const username = usernameRaw ? usernameRaw.toLowerCase() : null; // normalized (for lookups)

      // 2) Persist profile; keep username normalized in UserProfile
      if (uid) {
        // sync profile used for @username → chatId resolution
        await UserProfile.updateOne(
          { chatId: uid },
          { $set: { chatId: uid, firstName, lastName, username } },
          { upsert: true }
        );

        // keep latest names on roles (if any)
        await UserRole.updateMany(
          { chatId: uid },
          { $set: { firstName, lastName, username: usernameRaw ?? null } },
          { upsert: false }
        );
      }

      // 3) Auto-create role if none exists (makes new users usable immediately)
      if (uid) {
        const existingRole = await UserRole.findOne({ chatId: uid }).lean();
        if (!existingRole) {
          await UserRole.create({
            chatId: uid,
            role: "user",
            firstName,
            lastName,
            username: usernameRaw ?? null,
          });
          console.log(`👤 Auto-added user with role "user": ${uid}`);
        }
      }

      // clear any pending add-user session mode
      if (ctx.session) ctx.session.mode = null;

      // 4) Show UI depending on role
      const admin = await isAdmin(uid);
      const user = admin ? true : await isUser(uid);

      if (admin) {
        await ctx.reply("Assalomu alaykum, Admin! 🛠 Panelni ochyapman…", adminPanelKeyboard());
        await ctx.reply("Tanlang:", mainReplyKeyboard(true));
        return;
      }

      if (user) {
        await ctx.reply(
          "Assalomu alaykum! Siz buyurtmalar ro‘yxatini ko‘rishingiz mumkin.",
          mainReplyKeyboard(false)
        );
        return;
      }

      // (fallback) Shouldn’t normally happen because we auto-add role=user above
      await ctx.reply(
        [
          "Assalomu alaykum!",
          "Siz hozircha ro‘yxatdan o‘tmagan foydalanuvchisiz.",
          "Iltimos, admin bilan bog‘laning va sizni qo‘shishini so‘rang.",
        ].join("\n")
      );
    } catch (err) {
      console.error("start handler error:", err);
      await ctx.reply("Kutilmagan xatolik. Keyinroq urinib ko‘ring.");
    }
  });

  // Reply-keyboard actions (call the shared paginator helper directly)
  bot.hears(REPLY_BTN.VIEW, async (ctx) => {
    try { await ctx.deleteMessage(); } catch {}
    await openBookingsPage(ctx, 1);
  });

  bot.hears(REPLY_BTN.USERS, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) return;
    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply("🛠 Admin Panel", adminPanelKeyboard());
  });

  bot.hears(REPLY_BTN.HELP, async (ctx) => {
    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply("Commands: /bookings, /panel (admin), /help, /id");
  });
}
