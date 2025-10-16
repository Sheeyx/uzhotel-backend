import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
  console.warn("[mailer] Missing SMTP env vars. Email sending may fail.",SMTP_HOST);
}

export const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: String(SMTP_SECURE || "").toLowerCase() === "true", // true=465, false=587
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export type BookingEmailPayload = {
  roomTitle: string;
  guestName: string;
  phone: string;
  email?: string | null;
  nationality?: string | null;
  checkin: string;
  checkout: string;
  nights: number;
  guests: number;
  totalPrice: number;
};

export async function sendBookingEmailNodemailer(
  payload: BookingEmailPayload,
  toOverride?: string
) {
  const to = (toOverride || MAIL_TO || SMTP_USER)!;
  const subject = `New Booking: ${payload.roomTitle} — ${payload.guestName}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">
      <h2 style="margin:0 0 12px">New Booking</h2>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Room</b></td><td>${payload.roomTitle}</td></tr>
        <tr><td><b>Guest</b></td><td>${payload.guestName}</td></tr>
        <tr><td><b>Phone</b></td><td>${payload.phone}</td></tr>
        <tr><td><b>Email</b></td><td>${payload.email || "-"}</td></tr>
        <tr><td><b>Nationality</b></td><td>${payload.nationality || "-"}</td></tr>
        <tr><td><b>Check-in</b></td><td>${payload.checkin}</td></tr>
        <tr><td><b>Check-out</b></td><td>${payload.checkout}</td></tr>
        <tr><td><b>Nights</b></td><td>${payload.nights}</td></tr>
        <tr><td><b>Guests</b></td><td>${payload.guests}</td></tr>
        <tr><td><b>Total</b></td><td>${payload.totalPrice.toLocaleString("uz-UZ")} UZS</td></tr>
      </table>
    </div>
  `.trim();

  try {
    const info = await mailer.sendMail({
      from: MAIL_FROM!,
      to,
      subject,
      html,
    });
    return info;
  } catch (e: any) {
    console.error("[mailer] sendMail error", {
      code: e?.code,
      command: e?.command,
      response: e?.response,
      responseCode: e?.responseCode,
      message: e?.message,
    });
    throw e;
  }
}
