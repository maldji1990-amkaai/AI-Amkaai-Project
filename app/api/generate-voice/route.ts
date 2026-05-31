import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { addJob } from "@/lib/queue";
import { useCredits } from "@/lib/credits";
import { demoVoices } from "@/lib/demo";

const VOICE_COST = 5;

export async function POST(req: Request) {
  try {
    console.log("🚀 VOICE API HIT");

    // 🔐 AUTH
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 👤 GET USER
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 📦 PARSE BODY
    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { text } = body;

    if (!text || text.trim().length < 3) {
      return NextResponse.json(
        { error: "Valid text is required" },
        { status: 400 }
      );
    }

console.log("📝 Voice text:", text);

//////////////////////////////////////////////////
// 🧠 DEMO MODE (VOICE)
//////////////////////////////////////////////////

if (user.plan === "FREE") {
  const randomVoice =
    demoVoices[
      Math.floor(Math.random() * demoVoices.length)
    ];

  return NextResponse.json({
    success: true,
    demo: true,
    audio: randomVoice,
    message: "Demo preview — Upgrade to Pro for real AI voice",
  });
}

// ✅ تحقق قبل الخصم
if (user.plan !== "FREE" && user.credits < VOICE_COST) {
  return NextResponse.json(
    { error: "Not enough credits" },
    { status: 403 }
  );
}

// 💸 USE CREDITS
try {
  await useCredits(user.id, "voice");
} catch (err: any) {
  return NextResponse.json(
    {
      error: err.message || "Not enough credits",
    },
    { status: 403 }
  );
}

    // 📦 CREATE VOICE JOB
    let job;

    try {
      job = await db.voiceJob.create({
        data: {
          userId: user.id,
          text,
          status: "PENDING",
        },
      });

      console.log("🎤 VOICE JOB CREATED:", job.id);
    } catch (err) {
      console.error("🔥 VOICE JOB CREATE FAILED:", err);

      return NextResponse.json(
        { error: "Failed to create voice job" },
        { status: 500 }
      );
    }

    // 🧠 QUEUE
    try {
      addJob({
        id: job.id,
        type: "voice",
      });

      console.log("📤 VOICE JOB SENT TO QUEUE");
    } catch (err) {
      console.log("⚠️ Queue error:", err);
    }

    // 🚀 RESPONSE (same system as video/image)
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "PENDING",
      message: "Voice is being generated",
    });

  } catch (error) {
    console.error("🔥 VOICE API FATAL ERROR:", error);

    return NextResponse.json(
      {
        error: "Server error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}