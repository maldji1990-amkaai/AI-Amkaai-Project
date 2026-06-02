import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { addJob } from "@/lib/queue";
import { useCredits } from "@/lib/credits";
import { demoVoices } from "@/lib/demo";
import { PlanType } from "@prisma/client";

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
    let user = await db.user.findUnique({
  where: { clerkId: userId },
});

// ✅ AUTO CREATE USER (VERY IMPORTANT)
if (!user) {
  user = await db.user.create({
    data: {
      clerkId: userId,
      credits: 10,
      plan: PlanType.FREE,
    },
  });

  console.log("✅ New user created:", user.id);
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
    // 🧠 DEMO MODE
    //////////////////////////////////////////////////

    if (user.plan === PlanType.FREE) {
      if (user.credits < VOICE_COST) {
        return NextResponse.json(
          { error: "Free limit reached" },
          { status: 403 }
        );
      }

      const randomVoice =
        demoVoices[
          Math.floor(Math.random() * demoVoices.length)
        ];

      return NextResponse.json({
        success: true,
        demo: true,
        audio: randomVoice,
        message:
          "Demo preview — Upgrade to Pro for real AI voice",
      });
    }

    //////////////////////////////////////////////////
    // 💸 USE CREDITS (PRO / PREMIUM)
    //////////////////////////////////////////////////

    try {
      await useCredits(user.id, "voice");
    } catch (err: any) {
      return NextResponse.json(
        {
          error:
            err.message || "Not enough credits",
        },
        { status: 403 }
      );
    }

    //////////////////////////////////////////////////
    // 📦 CREATE JOB
    //////////////////////////////////////////////////

    const job = await db.voiceJob.create({
      data: {
        userId: user.id,
        text,
        status: "PENDING",
      },
    });

    console.log("🎤 VOICE JOB CREATED:", job.id);

    //////////////////////////////////////////////////
    // 🧠 QUEUE
    //////////////////////////////////////////////////

    try {
      addJob({
        id: job.id,
        type: "voice",
      });

      console.log("📤 VOICE JOB SENT TO QUEUE");
    } catch (err) {
      console.log("⚠️ Queue error:", err);
    }

    //////////////////////////////////////////////////
    // 🚀 RESPONSE
    //////////////////////////////////////////////////

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "PENDING",
      message: "Voice is being generated",
    });

  } catch (error) {
    console.error(
      "🔥 VOICE API FATAL ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Server error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}