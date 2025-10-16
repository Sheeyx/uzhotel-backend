import type { MyContext } from "../types";
import { usersListKeyboard } from "../keyboards";
import { isAdmin } from "../roles";
import { ENV } from "../../config";
import { UserRole, type UserRoleLean } from "../../models/userRole";
import { UserProfile } from "../../models/UserProfile";
import { Markup } from "telegraf";

/** Parse admin input into either {id} or {username} */
function parseUserIdentifier(text: string): { id?: string; username?: string } {
  const raw = String(text || "").trim();

  // numeric id
  if (/^\d{4,}$/.test(raw)) return { id: String(Math.trunc(Number(raw))) };

  // t.me links
  const linkMatch = raw.match(/(?:^|https?:\/\/)?t\.me\/(@?)([A-Za-z0-9_]{5,})\/?$/i);
  if (linkMatch) return { username: linkMatch[2].toLowerCase() };

  // @username
  const atMatch = raw.match(/^@?([A-Za-z0-9_]{5,})$/);
  if (atMatch) return { username: atMatch[1].toLowerCase() };

  return {};
}

async function listUsersTextAndKb() {
  const list = await UserRole.find({})
    .select({ chatId: 1, role: 1, username: 1, _id: 0 })
    .sort({ role: -1, chatId: 1 })
    .lean<UserRoleLean[]>();

  if (!list.length) {
    return {
      text: "No users yet.",
      kb: Markup.inlineKeyboard([
        [Markup.button.callback("➕ Add user", "user:add")],
        [Markup.button.callback("⬅️ Back", "panel:back")],
      ]),
    };
  }

  return { text: "👥 Users", kb: usersListKeyboard(list) };
}

export function registerUsers(bot: import("telegraf").Telegraf<MyContext>) {
  // Open Users panel
  bot.action("panel:users", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) return;
    await ctx.answerCbQuery();

    const { text, kb } = await listUsersTextAndKb();
    await ctx.reply(text, kb);
  });

  // Remove user (protect env admins)
  bot.action(/user:rm:(.+)/, async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) return;
    const chatId = ctx.match?.[1];
    if (!chatId) return void ctx.answerCbQuery("Bad payload");

    if (ENV.ADMIN_CHAT_IDS.includes(chatId)) {
      await ctx.answerCbQuery("Protected admin");
      return;
    }

    await UserRole.deleteMany({ chatId });
    await ctx.answerCbQuery("Removed");

    const { text, kb } = await listUsersTextAndKb();
    await ctx.reply(`${text} (updated)`, kb);
  });

  // Begin add flow
  bot.action("user:add", async (ctx) => {
    if (!(await isAdmin(ctx.from?.id))) return;
    await ctx.answerCbQuery();
    ctx.session.mode = "await_add_user";

    await ctx.reply(
      [
        "Send the user’s identifier:",
        "• Numeric Telegram ID (e.g. 123456789)  — or —",
        "• Username (e.g. @john_doe or https://t.me/john_doe)",
        "",
        "Note: the user must press /start in this bot once so we can capture their ID.",
      ].join("\n")
    );
  });

  // Handle input while in add mode
  bot.on("text", async (ctx, next) => {
    if (ctx.session.mode !== "await_add_user") return next();

    if (!(await isAdmin(ctx.from?.id))) {
      ctx.session.mode = null;
      return;
    }

    const raw = (ctx.message as any)?.text?.trim() ?? "";
    const parsed = parseUserIdentifier(raw);

    // Case 1: numeric id
    if (parsed.id) {
      const chatId = parsed.id;

      // Upsert as "user"
      await UserRole.updateOne(
        { chatId, role: "user" },
        { $set: { chatId, role: "user" } },
        { upsert: true }
      );

      ctx.session.mode = null;
      await ctx.reply(`✅ Added user ${chatId} as "user".`);

      const { text, kb } = await listUsersTextAndKb();
      await ctx.reply(`${text} (updated)`, kb);
      return;
    }

    // Case 2: username
    if (parsed.username) {
      const username = parsed.username;

      // Look up in UserProfile (populated when user did /start)
      const profile = await UserProfile.findOne({ username }).lean<{ chatId?: string } | null>();

      if (!profile?.chatId) {
        await ctx.reply(
          [
            `⚠️ I can’t resolve @${username} to a chat ID yet.`,
            "Ask them to open this bot and press /start once.",
            "Then try adding again.",
          ].join("\n")
        );
        return;
      }

      const chatId = String(profile.chatId);

      await UserRole.updateOne(
        { chatId, role: "user" },
        { $set: { chatId, role: "user", username } },
        { upsert: true }
      );

      ctx.session.mode = null;
      await ctx.reply(`✅ Added @${username} (id: ${chatId}) as "user".`);

      const { text, kb } = await listUsersTextAndKb();
      await ctx.reply(`${text} (updated)`, kb);
      return;
    }

    // Neither numeric nor username
    await ctx.reply("Please send a valid numeric ID or @username / t.me/username.");
  });
}
