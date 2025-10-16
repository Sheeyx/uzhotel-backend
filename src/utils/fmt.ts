import dayjs from 'dayjs';

export function fmtBookingText(b: {
  roomTitle: string;
  guestName: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  checkin: string;
  checkout: string;
  nights?: number | null;
  guests: number;
  totalPrice?: number | null;
  _id?: any; // can be ObjectId on lean()
}) {
  const ni = typeof b.nights === 'number' ? b.nights : undefined;
  const total = typeof b.totalPrice === 'number' ? b.totalPrice : undefined;

  // Always escape/coerce dynamic parts
  const d1 = escapeMd(dayjs(b.checkin).format('YYYY-MM-DD'));
  const d2 = escapeMd(dayjs(b.checkout).format('YYYY-MM-DD'));
  const room = escapeMd(b.roomTitle);
  const guest = escapeMd(b.guestName);
  const nat = b.nationality ? escapeMd(b.nationality) : null;
  const phone = b.phone ? escapeMd(b.phone) : null;
  const email = b.email ? escapeMd(b.email) : null;
  const guests = escapeMd(b.guests);
  const totalTxt = typeof total === 'number' ? escapeMd(formatUZS(total)) : null;

  // ⚠️ _id might be an ObjectId on lean() → coerce to string before escaping
  const idStr = b?._id != null ? String(b._id) : '';
  const idLine = idStr ? `\n\\#${escapeMd(idStr)}` : '';

  const nightsSuffix = ni ? `  \\(${escapeMd(ni)} nights\\)` : '';

  const lines = [
    `🏨 *New Booking*`,
    `• Room: *${room}*`,
    `• Guest: *${guest}*`,
    `• Guests: *${guests}*`,
    `• Dates: *${d1}* → *${d2}*${nightsSuffix}`,
    nat ? `• Nationality: *${nat}*` : null,
    phone ? `• Phone: *${phone}*` : null,
    email ? `• Email: *${email}*` : null,
    totalTxt ? `• Total: *${totalTxt}*` : null,
    idLine || null,
  ].filter(Boolean) as string[];

  return lines.join('\n');
}

export function formatUZS(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n) + ' so‘m';
}

// Robust escaper: accepts any type, safely stringifies, then escapes MarkdownV2 specials
function escapeMd(value: unknown) {
  const s = String(value ?? '');
  // MarkdownV2 reserved: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
