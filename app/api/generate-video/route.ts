import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createQueuedVideoJob } from "@/lib/create-video-job";
import { LIMITS, FEATURES } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!FEATURES.enableVideoQueue) return NextResponse.json({ error: "Video generation is temporarily disabled" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < LIMITS.minPromptLength) return NextResponse.json({ error: `Prompt too short. Minimum ${LIMITS.minPromptLength} characters.` }, { status: 400 });
  if (prompt.length > LIMITS.maxPromptLength) return NextResponse.json({ error: `Prompt too long. Maximum ${LIMITS.maxPromptLength} characters.` }, { status: 400 });
  const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  try {
    const result = await createQueuedVideoJob({
      userId: user.id,
      clerkId,
      prompt,
      duration: Number(body?.duration),
      projectId: body?.projectId || null,
      sceneId: body?.sceneId || null,
      characterIds: Array.isArray(body?.characterIds) ? body.characterIds.map(String) : [],
      voiceProfileId: body?.voiceProfileId || null,
      referenceId: req.headers.get("Idempotency-Key")?.trim() || undefined,
      imageUrl: typeof body?.imageUrl === "string" ? body.imageUrl : null,
    });
    return NextResponse.json({ success: true, ...result, status: "queued" });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message === "NOT_ENOUGH_CREDITS") return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan." }, { status: 402 });
    if (message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") return NextResponse.json({ error: "Your subscription has expired or is past due." }, { status: 403 });
    if (message === "PROJECT_NOT_FOUND" || message === "SCENE_NOT_FOUND" || message === "CHARACTER_NOT_FOUND" || message === "VOICE_PROFILE_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "QUEUE_UNAVAILABLE") return NextResponse.json({ error: "Video queue unavailable. Credits refunded." }, { status: 503 });
    if (message.startsWith("VIDEO_DURATION_LIMIT:")) return NextResponse.json({ error: `Maximum video duration is ${message.split(":")[1]} seconds.` }, { status: 400 });
    if (message === "IDEMPOTENCY_KEY_REUSED") return NextResponse.json({ error: "Idempotency-Key belongs to another user." }, { status: 409 });
    return NextResponse.json({ error: "Failed to start video generation" }, { status: 500 });
  }
}
