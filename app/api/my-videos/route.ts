// app/api/my-videos/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const jobs = await db.videoJob.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50, // آخر 50 فيديو
      select: {
        id:         true,
        prompt:     true,
        status:     true,
        resultUrl:  true,
        progress:   true,
        createdAt:  true,
        finishedAt: true,
      },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("[MY_VIDEOS]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
