import { Markup } from "telegraf";
import type { UserRoleLean } from "../models/userRole";
import { ENV } from "../config";

export function adminPanelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📚 View bookings", "panel:bookings")],
    [Markup.button.callback("👥 Users", "panel:users")],
    [Markup.button.callback("ℹ️ Help", "panel:help")],
  ]);
}

export function usersListKeyboard(list: Array<Pick<UserRoleLean, "chatId" | "role" | "username">>) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (const u of list) {
    const label = `${u.role === "admin" ? "⭐" : "👤"} ${u.username ? "@" + u.username : u.chatId}`;
    const removable = !(u.role === "admin" && ENV.ADMIN_CHAT_IDS.includes(u.chatId));
    rows.push([
      Markup.button.callback(label, `noop:${u.chatId}`),
      ...(removable ? [Markup.button.callback("❌ Remove", `user:rm:${u.chatId}`)] : []),
    ]);
  }
  rows.push([
    Markup.button.callback("➕ Add user", "user:add"),
    Markup.button.callback("⬅️ Back", "panel:back"),
  ]);
  return Markup.inlineKeyboard(rows);
}
