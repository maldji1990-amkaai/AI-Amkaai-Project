import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { addJob } from "@/lib/queue";
import { demoVideos } from "@/lib/demo";

const VIDEO_COST = 30;

export async function POST(req: Request) {
  try {
    console.log("🚀 STEP 1: API HIT");

    // 🔐 Auth
    const { userId } = await auth();

    if (!userId) {
      console.log("❌ No userId");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("👤 Clerk userId:", userId);

    // 👤 Get user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      console.log("❌ User not found in DB");
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("✅ User found:", user.id);

    // 💳 Check credits
    if (user.credits < VIDEO_COST) {
      console.log("❌ Not enough credits");
      return NextResponse.json(
        { error: "Not enough credits" },
        { status: 403 }
      );
    }

    // 📦 Parse request
    let body;
    try {
      body = await req.json();
    } catch (err) {
      console.log("❌ Invalid JSON");
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const { prompt } = body;

    if (!prompt) {
      console.log("❌ Missing prompt");
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    console.log("📝 Prompt:", prompt);
//////////////////////////////////////////////////
// 🧠 DEMO MODE (CRITICAL - NO COST)
//////////////////////////////////////////////////

if (user.plan === "FREE") {
  const randomVideo =
    demoVideos[
      Math.floor(Math.random() * demoVideos.length)
    ];

  console.log("🧪 DEMO VIDEO:", randomVideo);

  return NextResponse.json({
    success: true,
    demo: true,
    video: randomVideo,
    message: "Demo preview — Upgrade to Pro for real AI video",
  });
}

    // ⚡ IMPORTANT: Skip usage temporarily (to avoid crash)
    let usage = null;

    try {
      usage = await db.usage.create({
        data: {
          userId: user.id,
          type: "video",
          cost: VIDEO_COST,
          status: "PENDING",
        },
      });

      console.log("📊 Usage created:", usage.id);
    } catch (err) {
      console.log("⚠️ Usage create failed, continuing anyway:", err);
    }

    // 🚀 Create video job (MAIN CRITICAL PART)
    let job;

    try {
      job = await db.videoJob.create({
        data: {
          userId: user.id,
          prompt,
          usageId: usage?.id ?? null,
          status: "PENDING",
        },
      });

      console.log("🎬 Job created:", job.id);
    } catch (err) {
      console.log("🔥 VIDEO JOB CREATE FAILED:", err);

      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }

    // 💸 Deduct credits AFTER job creation
    try {
      await db.user.update({
        where: { id: user.id },
        data: {
          credits: {
            decrement: VIDEO_COST,
          },
        },
      });

      console.log("💸 Credits deducted");
    } catch (err) {
      console.log("⚠️ Credit deduction failed:", err);
    }

    // 🧠 Push job to queue
    try {
      addJob({
        id: job.id,
        type: "video",
      });

      console.log("📤 Job sent to queue");
    } catch (err) {
      console.log("⚠️ Queue error:", err);
    }

    // ✅ RESPONSE
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "PENDING",
      message: "Video is being generated",
    });

  } catch (error) {
    console.error("🔥 FATAL VIDEO API ERROR:", error);

    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}