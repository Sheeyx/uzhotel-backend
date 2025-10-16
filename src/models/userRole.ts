import mongoose, { Schema, InferSchemaType, Model } from 'mongoose';

const UserRoleSchema = new Schema(
  {
    chatId: { type: String, required: true, index: true },
    role:   { type: String, enum: ['admin', 'user'], required: true, index: true },
    username:  { type: String, default: null },
    firstName: { type: String, default: null },
    lastName:  { type: String, default: null },
  },
  { timestamps: true }
);

// Prevent duplicates per (chatId, role)
UserRoleSchema.index({ chatId: 1, role: 1 }, { unique: true });

export type UserRoleDoc = InferSchemaType<typeof UserRoleSchema> & { _id: string };
export type UserRoleLean = UserRoleDoc; // handy alias for lean()

export const UserRole: Model<UserRoleDoc> =
  mongoose.models.UserRole || mongoose.model<UserRoleDoc>('UserRole', UserRoleSchema);
