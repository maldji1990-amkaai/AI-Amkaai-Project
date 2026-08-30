import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";

export async function GET() {
  const clerkUser = await currentUser();
  if (!clerkUser?.id) return NextResponse.json({ plan: "TRIAL", credits: 0 }, { status: 401 });
  const user = await getOrCreateUser(clerkUser.id);
  return NextResponse.json({ plan: user?.plan || "TRIAL", credits: user?.credits || 0 });
}
