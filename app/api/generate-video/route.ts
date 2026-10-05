import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { createQueuedVideoJob } from "@/lib/create-video-job";
import { LIMITS, FEATURES } from "@/lib/config";
import { NotEnoughCreditsError, calculateCreditCost } from "@/lib/credits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ENHANCE_LENGTH = 4000;

function fallbackEnhancePrompt(
  prompt: string,
  duration: number,
  cameraMotion?: string,
  aspectRatio?: string,
) {
  const motion = cameraMotion?.trim() || "natural";
  const ratio = aspectRatio?.trim() || "16:9";

  return [
    prompt.trim(),
    "cinematic video",
    "natural realistic motion",
    "coherent subject movement",
    "detailed environment",
    "professional lighting",
    `smooth ${motion} camera movement`,
    `${ratio} composition`,
    `approximately ${duration} seconds`,
    "high visual quality",
    "consistent scene and subject identity",
  ].join(", ");
}

async function autoEnhancePrompt(
  prompt: string,
  duration: number,
  cameraMotion?: string,
  aspectRatio?: string,
) {
  // Auto Enhance can be disabled without changing the RunPod/queue system.
  if (process.env.AUTO_ENHANCE_PROMPT === "false") {
    return { enhancedPrompt: prompt, provider: "disabled" };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Important: enhancement must NEVER prevent video generation.
  if (!apiKey) {
    return {
      enhancedPrompt: fallbackEnhancePrompt(prompt, duration, cameraMotion, aspectRatio),
      provider: "fallback",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "You are AmkaAI's automatic video prompt enhancer.",
                  "Turn a short user idea into a strong prompt for a text-to-video model.",
                  "Preserve the user's intent exactly.",
                  "Never change, remove, replace, or contradict the main subject, action, location, named person/object, requested style, or explicit constraints.",
                  "Only add useful visual detail such as scene context, appearance when unspecified, natural motion, camera direction, composition, lighting, atmosphere, temporal continuity, and cinematic realism.",
                  "Do not invent specific facts, brands, identities, dialogue, locations, or story events that the user did not request.",
                  "Do not make the prompt radically different from the user's idea.",
                  "Return ONLY the final video prompt. No heading, explanation, quotation marks, or markdown.",
                  `Video settings: aspect ratio ${aspectRatio || "16:9"}; camera motion ${cameraMotion || "natural"}; duration about ${duration} seconds.`,
                ].join("\n"),
              },
            ],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        max_output_tokens: 700,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        enhancedPrompt: fallbackEnhancePrompt(prompt, duration, cameraMotion, aspectRatio),
        provider: "fallback",
      };
    }

    const outputText =
      typeof data?.output_text === "string" ? data.output_text.trim() : "";

    if (!outputText || outputText.length > MAX_ENHANCE_LENGTH) {
      return {
        enhancedPrompt: fallbackEnhancePrompt(prompt, duration, cameraMotion, aspectRatio),
        provider: "fallback",
      };
    }

    return { enhancedPrompt: outputText, provider: "openai" };
  } catch (error) {
    console.error("AUTO_ENHANCE_PROMPT_FAILED", error);

    return {
      enhancedPrompt: fallbackEnhancePrompt(prompt, duration, cameraMotion, aspectRatio),
      provider: "fallback",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FEATURES.enableVideoQueue) {
    return NextResponse.json(
      { error: "Video generation is temporarily disabled" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));

  const originalPrompt =
    typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!originalPrompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (originalPrompt.length > LIMITS.maxPromptLength) {
    return NextResponse.json(
      {
        error: `Prompt too long. Maximum ${LIMITS.maxPromptLength} characters.`,
      },
      { status: 400 },
    );
  }

  const user = await getOrCreateUser(clerkId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const duration = Number(body?.duration);

  let requiredCredits = 0;

  try {
    requiredCredits = calculateCreditCost("video", { duration });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID_VIDEO_DURATION"
    ) {
      return NextResponse.json(
        { error: "Invalid video duration" },
        { status: 400 },
      );
    }

    throw error;
  }

  /*
   * AUTO ENHANCE
   *
   * The enhanced prompt is created BEFORE the existing queued job is created.
   * Nothing below this point changes the RunPod/BullMQ flow.
   */
  const { enhancedPrompt, provider: enhanceProvider } =
    await autoEnhancePrompt(
      originalPrompt,
      duration,
      typeof body?.cameraMotion === "string" ? body.cameraMotion : undefined,
      typeof body?.aspectRatio === "string" ? body.aspectRatio : undefined,
    );

  // Keep the existing prompt-length safety rule for the actual generation prompt.
  if (enhancedPrompt.length > LIMITS.maxPromptLength) {
    return NextResponse.json(
      {
        error: `Enhanced prompt is too long. Maximum ${LIMITS.maxPromptLength} characters.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await createQueuedVideoJob({
      userId: user.id,
      clerkId,
      // IMPORTANT: RunPod receives the enhanced prompt, while all queue/credit
      // handling remains exactly where it was.
      prompt: enhancedPrompt,
      duration,
      projectId: body?.projectId || null,
      sceneId: body?.sceneId || null,
      characterIds: Array.isArray(body?.characterIds)
        ? body.characterIds.map(String)
        : [],
      voiceProfileId: body?.voiceProfileId || null,
      referenceId:
        req.headers.get("Idempotency-Key")?.trim() || undefined,
      imageUrl: typeof body?.imageUrl === "string" ? body.imageUrl : null,
    });

    return NextResponse.json({
      success: true,
      ...result,
      status: "queued",
      autoEnhanced: enhancedPrompt !== originalPrompt,
      enhanceProvider,
      originalPrompt,
      enhancedPrompt,
    });
  } catch (error: any) {
    const message = String(error?.message || "");

    if (
      error instanceof NotEnoughCreditsError ||
      message === "NOT_ENOUGH_CREDITS"
    ) {
      const remainingCredits =
        error instanceof NotEnoughCreditsError
          ? error.remainingCredits
          : Math.max(0, Number(user.credits) || 0);

      const required =
        error instanceof NotEnoughCreditsError
          ? error.requiredCredits
          : requiredCredits;

      return NextResponse.json(
        {
          error: "Not enough credits",
          code: "NOT_ENOUGH_CREDITS",
          requiredCredits: required,
          remainingCredits,
          creditsPerSecond:
            required > 0 && duration > 0
              ? required / Math.ceil(duration)
              : undefined,
        },
        { status: 402 },
      );
    }

    if (message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
      return NextResponse.json(
        { error: "Your subscription has expired or is past due." },
        { status: 403 },
      );
    }

    if (
      message === "PROJECT_NOT_FOUND" ||
      message === "SCENE_NOT_FOUND" ||
      message === "CHARACTER_NOT_FOUND" ||
      message === "VOICE_PROFILE_NOT_FOUND"
    ) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message === "QUEUE_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Video queue unavailable. Credits refunded." },
        { status: 503 },
      );
    }

    if (message.startsWith("VIDEO_DURATION_LIMIT:")) {
      return NextResponse.json(
        {
          error: `Maximum video duration is ${message.split(":")[1]} seconds.`,
        },
        { status: 400 },
      );
    }

    if (message === "IDEMPOTENCY_KEY_REUSED") {
      return NextResponse.json(
        { error: "Idempotency-Key belongs to another user." },
        { status: 409 },
      );
    }

    if (message === "INVALID_VIDEO_DURATION") {
      return NextResponse.json(
        { error: "Invalid video duration" },
        { status: 400 },
      );
    }

    if (message === "USAGE_ALREADY_PENDING") {
      return NextResponse.json(
        { error: "This generation request is already being processed." },
        { status: 409 },
      );
    }

    if (message === "USAGE_ALREADY_COMPLETED") {
      return NextResponse.json(
        { error: "This generation request has already completed." },
        { status: 409 },
      );
    }

    if (
      message === "USAGE_ALREADY_REFUNDED" ||
      message === "USAGE_REFERENCE_ALREADY_USED"
    ) {
      return NextResponse.json(
        { error: "This generation request can no longer be reused." },
        { status: 409 },
      );
    }

    console.error("GENERATE_VIDEO_UNEXPECTED_ERROR", {
      clerkId,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to start video generation" },
      { status: 500 },
    );
  }
}
