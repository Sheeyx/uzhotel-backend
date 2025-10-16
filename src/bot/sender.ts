// src/bot/sender.ts
import { Markup } from "telegraf";
import { bot } from "./bot";
import type { BookingDoc } from "../models/Booking";

/** Strict HTML escaper for Telegram HTML parse_mode */
function escapeHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format date as "16 Oct 2025, 19:42" (local time) */
function formatDateTime(date: Date | string | number) {
  try {
    const d = new Date(date);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
}

/** Build a booking card as safe HTML (for parse_mode: "HTML") */
export function buildBookingHtml(b: BookingDoc) {
  const room = escapeHtml(b.roomTitle);
  const guest = escapeHtml(b.guestName);
  const guests = Number(b.guests ?? 1);
  const dates = `${escapeHtml(b.checkin)} → ${escapeHtml(b.checkout)}`;
  const nights =
    typeof b.nights === "number" && Number.isFinite(b.nights)
      ? ` (${b.nights} night${b.nights === 1 ? "" : "s"})`
      : "";
  const nat = b.nationality ? escapeHtml(b.nationality) : "—";
  const phone = b.phone ? escapeHtml(b.phone) : "—";
  const price =
    typeof b.totalPrice === "number" && Number.isFinite(b.totalPrice)
      ? `${new Intl.NumberFormat("uz-UZ").format(b.totalPrice)} so‘m`
      : "—";

  const createdAt = b.createdAt ? formatDateTime(b.createdAt) : "—";

  // Show the Mongo _id as a non-preview link line (prevents rich preview)
  const idLine = `<a href="https://t.me/${" "}">${escapeHtml(String(b._id))}</a>`;

  return (
    `🏨 <b>New Booking</b>\n` +
    `• <b>Room:</b> ${room}\n` +
    `• <b>Guest:</b> ${guest}\n` +
    `• <b>Guests:</b> ${guests}\n` +
    `• <b>Dates:</b> ${dates}${nights}\n` +
    `• <b>Nationality:</b> ${nat}\n` +
    `• <b>Phone:</b> ${phone}\n` +
    `• <b>Total:</b> ${price}\n` +
    `• <b>Created:</b> ${createdAt}\n\n`
  );
}

/**
 * Send one booking card.
 * - HTML parse mode (no MarkdownV2 escaping headaches)
 * - Inline admin buttons if `asAdmin && withButtons`
 */
export async function sendBookingCard(
  chatId: string | number,
  b: BookingDoc,
  asAdmin = true,
  withButtons = true
) {
  const html = buildBookingHtml(b);

  const kb =
    withButtons && asAdmin
      ? Markup.inlineKeyboard([
          [
          ],
          [
          ],
        ])
      : undefined;

  try {
    const msg = await bot.telegram.sendMessage(chatId, html, {
      parse_mode: "HTML",
      ...(kb ? kb : {}),
    });
    console.log(`[notify] sent booking to ${chatId}`);
    return msg;
  } catch (err: any) {
    const msg = err?.response?.description || err.message || String(err);
    console.error(`[notify] failed for ${chatId}:`, msg);
    throw err;
  }
}

/** Reused by phone action */
export function normalizePhone(raw: string) {
  const t = String(raw || "").trim();
  if (!t) return t;
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D+/g, "");
  return t.replace(/\D+/g, "");
}
