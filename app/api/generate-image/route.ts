import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { addJob } from "@/lib/queue";
import { useCredits } from "@/lib/credits";
import { demoImages } from "@/lib/demo";

const IMAGE_COST = 10;

export async function POST(req: Request) {
  try {
    console.log("🚀 IMAGE API HIT");

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

    const { prompt } = body;

    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: "Valid prompt is required" },
        { status: 400 }
      );
    }

   console.log("📝 Prompt:", prompt);

//////////////////////////////////////////////////
// 🧠 DEMO MODE
//////////////////////////////////////////////////

if (user.plan === "FREE") {
  const randomImage =
    demoImages[
      Math.floor(Math.random() * demoImages.length)
    ];

  return NextResponse.json({
    success: true,
    demo: true,
    image: randomImage,
  });
}

// 💸 USE CREDITS (safe)
try {
  await useCredits(user.id, "image");
} catch (err: any) {
  return NextResponse.json(
    {
      error: err.message || "Not enough credits",
    },
    { status: 403 }
  );
}

    // 📦 CREATE IMAGE JOB
    let job;

    try {
      job = await db.imageJob.create({
        data: {
          userId: user.id,
          prompt,
          status: "PENDING",
        },
      });

      console.log("🎨 IMAGE JOB CREATED:", job.id);
    } catch (err) {
      console.error("🔥 IMAGE JOB CREATE FAILED:", err);

      return NextResponse.json(
        { error: "Failed to create image job" },
        { status: 500 }
      );
    }

    // 🧠 ADD TO QUEUE
    try {
      addJob({
        id: job.id,
        type: "image",
      });

      console.log("📤 IMAGE JOB SENT TO QUEUE");
    } catch (err) {
      console.log("⚠️ Queue error:", err);
    }

    // 🚀 RESPONSE (same as video system)
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "PENDING",
      message: "Image is being generated",
    });

  } catch (error) {
    console.error("🔥 IMAGE API FATAL ERROR:", error);

    return NextResponse.json(
      {
        error: "Server error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}