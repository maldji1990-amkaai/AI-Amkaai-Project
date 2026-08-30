import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function requireStudioUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("UNAUTHORIZED");
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}
