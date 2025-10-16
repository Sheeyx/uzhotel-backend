import { Markup } from "telegraf";

export const REPLY_BTN = {
  VIEW:  "📚 View bookings",
  USERS: "👥 Users",
  HELP:  "ℹ️ Help",
};

export function mainReplyKeyboard(isAdmin: boolean) {
  const rows: string[][] = isAdmin
    ? [[REPLY_BTN.VIEW], [REPLY_BTN.USERS, REPLY_BTN.HELP]]
    : [[REPLY_BTN.VIEW], [REPLY_BTN.HELP]];
  return Markup.keyboard(rows).resize().persistent();
}
