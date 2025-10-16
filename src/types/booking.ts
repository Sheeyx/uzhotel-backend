export type BookingPayload = {
  roomTitle: string;
  guestName: string;
  phone?: string;
  email?: string | null;
  nationality?: string | null;
  checkin: string;  // ISO yyyy-mm-dd
  checkout: string; // ISO yyyy-mm-dd
  nights?: number;
  guests: number;
  totalPrice?: number;
};
