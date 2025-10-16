import { ENV } from "../config";
import { UserRole, UserRoleLean } from "../models/userRole";

export function isEnvSuperAdmin(id?: number | string) {
  return id != null && ENV.ADMIN_CHAT_IDS.includes(String(id));
}

export async function isAdmin(id?: number | string) {
  if (!id) return false;
  if (isEnvSuperAdmin(id)) return true;
  const found = await UserRole.findOne({ chatId: String(id), role: "admin" }).lean<UserRoleLean | null>();
  return !!found;
}

export async function isUser(id?: number | string) {
  if (!id) return false;
  if (await isAdmin(id)) return true;
  const found = await UserRole.findOne({ chatId: String(id), role: "user" }).lean<UserRoleLean | null>();
  return !!found;
}

export async function ensureEnvAdminsSeeded() {
  if (!ENV.ADMIN_CHAT_IDS.length) return;
  await Promise.all(
    ENV.ADMIN_CHAT_IDS.map(async (chatId) => {
      await UserRole.updateOne(
        { chatId, role: "admin" },
        { $setOnInsert: { chatId, role: "admin" } },
        { upsert: true }
      );
    })
  );
}
