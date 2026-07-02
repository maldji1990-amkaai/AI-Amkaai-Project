import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";

export async function GET() {
  const clerkUser = await currentUser();
  const userId = clerkUser?.id;

  if (!userId) {
    return NextResponse.json({
      plan: "FREE",
      credits: 0,
    });
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  return NextResponse.json({
    plan: user?.plan || "FREE",
    credits: user?.credits || 0,
  });
}