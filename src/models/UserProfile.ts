import mongoose, { Schema, InferSchemaType } from 'mongoose';

const UserProfileSchema = new Schema({
  chatId: { type: String, required: true, unique: true, index: true },
  username: { type: String, default: null, index: true }, // store lowercase
  firstName: { type: String, default: null },
  lastName: { type: String, default: null },
}, { timestamps: true });

UserProfileSchema.pre('save', function (next) {
  // @ts-ignore
  if (this.username) this.username = String(this.username).toLowerCase();
  next();
});

export type UserProfileDoc = InferSchemaType<typeof UserProfileSchema> & { _id: string };

export const UserProfile =
  mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
