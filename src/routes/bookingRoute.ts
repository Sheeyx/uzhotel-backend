// src/routes/bookingRoute.ts
import { Router, Request, Response } from 'express';
import { requireApiKey } from '../utils/auth';
import { Booking, BookingDoc } from '../models/Booking';
import type { BookingPayload } from '../types/booking';
import { notifyBookingWithButtons } from '../bot/nitifier';

export const bookingRouter = Router();

// POST /api/bot/booking
bookingRouter.post('/booking/bot', requireApiKey, async (req: Request, res: Response) => {
  try {
    const p = (req.body || {}) as BookingPayload;

    // Minimal required fields
    if (!p.roomTitle || !p.guestName || !p.checkin || !p.checkout || !p.guests) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    // Create & persist
    const doc = await Booking.create({
      roomTitle: p.roomTitle,
      guestName: p.guestName,
      phone: p.phone ?? null,
      email: p.email ?? null,
      nationality: p.nationality ?? null,
      checkin: p.checkin,
      checkout: p.checkout,
      nights: typeof p.nights === 'number' ? p.nights : null,
      guests: Number(p.guests),
      totalPrice: typeof p.totalPrice === 'number' ? p.totalPrice : null,
      status: 'new',
    });

    // Telegram notify (fire-and-forget, HTTP javobni to‘smaslik uchun)
    const plain: BookingDoc = doc.toObject() as any;
    notifyBookingWithButtons(plain)
      .then(() => console.log('[notify] sent ok:', plain._id))
      .catch((err) => console.error('[notify] error:', err?.response ?? err));

    return res.json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('POST /api/bot/booking error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});
