// app/api/my-voices/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const jobs = await db.voiceJob.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id:         true,
        text:       true,   // VoiceJob يستخدم text بدل prompt
        status:     true,
        resultUrl:  true,
        progress:   true,
        createdAt:  true,
        finishedAt: true,
      },
    });

    // نحول text → prompt ليتوافق مع الـ interface
    const normalized = jobs.map(j => ({ ...j, prompt: j.text }));
    return NextResponse.json(normalized);
  } catch (error) {
    console.error("[MY_VOICES]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
