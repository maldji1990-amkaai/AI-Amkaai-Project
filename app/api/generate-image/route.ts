import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import {
  useCredits,
  refundCredits,
  markUsageSuccess,
} from "@/lib/credits";
import { demoVideos } from "@/lib/demo";
import { db } from "@/lib/db";
import { submitVideoToServerless } from "@/lib/runpod-serverless";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function autoEnhancePrompt(prompt: string): Promise<string> {
  const original = (prompt || "").trim();

  if (!original) {
    return "Bring this image to life with natural, realistic cinematic movement, subtle subject motion, smooth camera movement, coherent physics, and high visual quality.";
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return original;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "You are a professional AI image-to-video prompt enhancer. " +
              "Rewrite the user's prompt into one concise, production-ready video prompt. " +
              "Preserve the exact intent, subject, setting, and requested action. " +
              "Do not invent characters, objects, locations, dialogue, or story events. " +
              "Improve motion, camera movement, temporal consistency, lighting, and realism. " +
              "Return only the final prompt, without explanation or labels.",
          },
          { role: "user", content: original },
        ],
        max_output_tokens: 300,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("OpenAI prompt enhancement failed:", response.status);
      return original;
    }

    const data = await response.json();
    return typeof data?.output_text === "string" && data.output_text.trim()
      ? data.output_text.trim()
      : original;
  } catch (error) {
    console.warn("Prompt enhancement unavailable; using original prompt.", error);
    return original;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * RunPod's worker accepts a public HTTP(S) image URL.
 * If the frontend sends a Base64 data URI, upload it to Cloudinary first.
 */
async function getPublicImageUrl(uploadedImage: unknown): Promise<string> {
  if (typeof uploadedImage !== "string" || !uploadedImage.trim()) {
    throw new Error("INVALID_UPLOADED_IMAGE");
  }

  const value = uploadedImage.trim();

  if (value.startsWith("https://") || value.startsWith("http://")) {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("INVALID_IMAGE_URL");
    }
    return value;
  }

  const match = value.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/,
  );

  if (!match) {
    throw new Error(
      "IMAGE_MUST_BE_PUBLIC_URL_OR_BASE64_DATA_URI",
    );
  }

  const [, mimeType, base64Data] = match;
  const buffer = Buffer.from(base64Data.replace(/\s/g, ""), "base64");

  if (!buffer.length || buffer.length > 15 * 1024 * 1024) {
    throw new Error("IMAGE_SIZE_INVALID_OR_OVER_15MB");
  }

  const cloudName = process.env.CLOUDINARY_CLOUD;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_CONFIGURATION_MISSING_FOR_BASE64_IMAGE");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "amkaai/image-to-video";

  // Cloudinary signed upload: sorted parameters + API secret, SHA-1.
  const signatureBase = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(`${signatureBase}${apiSecret}`)
    .digest("hex");

  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: mimeType }),
    `input-image.${mimeType.split("/")[1].replace("jpeg", "jpg")}`,
  );
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    {
      method: "POST",
      body: form,
      cache: "no-store",
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok || typeof result?.secure_url !== "string") {
    console.error("Cloudinary image upload failed:", response.status);
    throw new Error("CLOUDINARY_IMAGE_UPLOAD_FAILED");
  }

  return result.secure_url;
}

export async function POST(request: Request) {
  const referenceId = `img2vid_${crypto.randomUUID()}`;
  let generationId: string | null = null;
  let creditsDeducted = false;

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, uploadedImage, aspectRatio } = body ?? {};

    if (!uploadedImage) {
      return NextResponse.json(
        { error: "الرجاء رفع صورة أولاً لتحويلها إلى فيديو" },
        { status: 400 },
      );
    }

    const user = await getOrCreateUser(userId);

    if (!user) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    let creditResult;

    try {
      creditResult = await useCredits(user.id, "video", {
        reference: referenceId,
      });
      creditsDeducted = true;
    } catch (error: any) {
      if (error?.message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
        return NextResponse.json(
          {
            error:
              "Your subscription has expired. Please check your billing dashboard.",
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        { error: error?.message || "Not enough credits" },
        { status: 402 },
      );
    }

    // Keep the existing free-trial demo behavior.
    if (user.plan === "TRIAL") {
      const fallbackVideo =
        Array.isArray(demoVideos) && demoVideos.length > 0
          ? demoVideos[Math.floor(Math.random() * demoVideos.length)]
          : null;

      if (!fallbackVideo) {
        await refundCredits(referenceId);
        return NextResponse.json(
          {
            error:
              "Demo video is temporarily unavailable. Your credits were refunded.",
          },
          { status: 503 },
        );
      }

      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        status: "done",
        videoUrl: fallbackVideo,
        demo: true,
        remainingCredits: creditResult.remainingCredits,
      });
    }

    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!webhookSecret || !appUrl) {
      throw new Error("RUNPOD_WEBHOOK_CONFIGURATION_MISSING");
    }

    const enhancedPrompt = await autoEnhancePrompt(
      typeof prompt === "string" ? prompt : "",
    );

    // Create the database record before submission so the callback can find it.
    const generation = await db.generation.create({
      data: {
        userId: user.id,
        type: "IMAGE_TO_VIDEO",
        prompt: enhancedPrompt,
        status: "PROCESSING",
        metadata: {
          provider: "RUNPOD_WAN22",
          referenceId,
          aspectRatio:
            typeof aspectRatio === "string" ? aspectRatio : "16:9",
        },
      },
    });

    generationId = generation.id;

    const imageUrl = await getPublicImageUrl(uploadedImage);

    const webhookUrl =
      `${appUrl.replace(/\/$/, "")}` +
      `/api/webhook/image-to-video?generationId=${encodeURIComponent(generation.id)}` +
      `&secret=${encodeURIComponent(webhookSecret)}`;

    await submitVideoToServerless({
      job_id: generation.id,
      custom_id: generation.id,
      webhook_url: webhookUrl,
      prompt: enhancedPrompt,
      image_url: imageUrl,
      duration_seconds: 5,
      clip_length_seconds: 5,
      clip_count: 1,
      model: "Wan2.2-TI2V-5B",
    });

    return NextResponse.json({
      success: true,
      status: "processing",
      generationId: generation.id,
      demo: false,
      remainingCredits: creditResult.remainingCredits,
    });
  } catch (error: any) {
    console.error("IMAGE-TO-VIDEO RUNPOD ERROR:", error);

    const errorMessage =
      typeof error?.message === "string"
        ? error.message
        : "IMAGE_TO_VIDEO_REQUEST_FAILED";

    if (generationId) {
      await db.generation
        .updateMany({
          where: { id: generationId, status: "PROCESSING" },
          data: {
            status: "FAILED",
            error: errorMessage,
          },
        })
        .catch((dbError) =>
          console.error("Could not mark generation failed:", dbError),
        );
    }

    if (creditsDeducted) {
      await refundCredits(referenceId).catch((refundError) =>
        console.error("Image-to-video credit refund failed:", refundError),
      );
    }

    return NextResponse.json(
      {
        error:
          "فشل إرسال طلب تحويل الصورة إلى RunPod. تم إرجاع النقاط إذا تم خصمها.",
        code: errorMessage,
      },
      { status: 500 },
    );
  }
}