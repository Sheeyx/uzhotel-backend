import mongoose, { Schema, InferSchemaType } from 'mongoose';

const BookingSchema = new Schema({
  roomTitle: { type: String, required: true },
  guestName: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  nationality: { type: String },
  checkin: { type: String, required: true },
  checkout: { type: String, required: true },
  nights: { type: Number },
  guests: { type: Number, required: true },
  totalPrice: { type: Number },
  status: { type: String, enum: ['new', 'approved', 'deleted'], default: 'new' },
}, { timestamps: true });

export type BookingDoc = InferSchemaType<typeof BookingSchema> & { _id: string };

export const Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
