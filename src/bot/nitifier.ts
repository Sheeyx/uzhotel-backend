import { ENV } from "../config";
import type { BookingDoc } from "../models/Booking";
import { sendBookingCard } from "./sender";
import { ensureEnvAdminsSeeded } from "./roles";

export async function notifyBookingWithButtons(b: BookingDoc) {
  console.log("[notify] booking:", { id: (b as any)._id, room: b.roomTitle, guest: b.guestName });
  await ensureEnvAdminsSeeded();

  if (!ENV.ADMIN_CHAT_IDS.length) {
    console.warn("[notify] No ADMIN_CHAT_IDS configured!");
    return;
  }

  for (const chatId of ENV.ADMIN_CHAT_IDS) {
    try {
      console.log("[notify] sending to", chatId);
      await sendBookingCard(chatId, b, true, true);
    } catch (err: any) {
      const msg = err?.response?.description || err.message || String(err);
      console.error(`[notify] error for ${chatId}:`, msg);
    }
  }
}
