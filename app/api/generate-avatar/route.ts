import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { demoAvatars } from "@/lib/demo";
import Replicate from "replicate";
import { requireOutputUrl } from "@/lib/ai-output";

// تهيئة حزمة Replicate باستخدام مفتاح البيئة السري
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Auto Enhance: expands a short user prompt into a clearer cinematic avatar direction.
// No OPENAI_PROMPT_MODEL variable is required. If OpenAI is unavailable, the original
// prompt is preserved so the existing AI generation pipeline is not broken.
async function enhanceAvatarPrompt(prompt: string): Promise<string> {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) return "expression driving pattern";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return cleanPrompt;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are an AI video prompt enhancer. Expand the user's short avatar direction into one concise, production-ready prompt for an AI avatar/video model. Preserve the user's exact intent. Add only useful details such as natural facial expression, subtle head movement, eye direction, lip sync, posture, lighting, camera framing and cinematic realism when appropriate. Do not invent a different subject, action, story, language, identity, or style. Return only the enhanced prompt, with no explanation, labels, or quotation marks.",
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: cleanPrompt },
            ],
          },
        ],
        max_output_tokens: 220,
      }),
    });

    if (!response.ok) {
      console.warn("⚠️ Auto Enhance unavailable:", response.status);
      return cleanPrompt;
    }

    const data = await response.json();
    const enhanced = typeof data?.output_text === "string"
      ? data.output_text.trim()
      : "";

    return enhanced || cleanPrompt;
  } catch (error) {
    console.warn("⚠️ Auto Enhance failed; using original prompt:", error);
    return cleanPrompt;
  }
}

export async function POST(request: Request) {
  // 🎯 إنشاء معرّف فريد للعملية لربط حجز النقاط وإرجاعها في حال الفشل
  const referenceId = `avt_${crypto.randomUUID()}`;

  try {
    console.log("🚀 REAL AI AVATAR API HIT");

    // 🔐 AUTH (التحقق من Clerk)
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // القراءة الديناميكية للبيانات المرفوعة من واجهة المستخدم
    const { prompt, uploadedImage } = await request.json();

    // 👤 Single canonical user provisioning path
    const user = await getOrCreateUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    //////////////////////////////////////////////////
    // 💸 USE CREDITS & SUBSCRIPTION CHECK (آمن وصارم)
    //////////////////////////////////////////////////
    let creditResult;
    try {
      creditResult = await useCredits(user.id, "image", { reference: referenceId });
    } catch (err: any) {
      if (err.message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
        return NextResponse.json({ error: "Your subscription has expired. Please check your billing dashboard." }, { status: 403 });
      }
      return NextResponse.json({ error: err.message || "Not enough credits" }, { status: 402 });
    }

    //////////////////////////////////////////////////
    // 🧠 DEMO MODE (FREE USERS)
    //////////////////////////////////////////////////
    if (user.plan === "TRIAL") {
      const avatar = Array.isArray(demoAvatars) && demoAvatars.length > 0
        ? demoAvatars[Math.floor(Math.random() * demoAvatars.length)]
        : null;
      if (!avatar) {
        await refundCredits(referenceId);
        return NextResponse.json({ error: "Demo avatar is temporarily unavailable. Your credits were refunded." }, { status: 503 });
      }

      // علم العملية كـ COMPLETED لأن الخدمة سلمت النتيجة الفورية للمستخدم
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        avatar, // سيعيد الرابط المؤقت للمستخدم المجاني
        demo: true,
        remainingCredits: creditResult.remainingCredits,
      });
    }

    //////////////////////////////////////////////////
    // 💎 paid plans (REAL AI ACTIVE)
    //////////////////////////////////////////////////
    try {
      if (!uploadedImage) {
        throw new Error("MISSING_SOURCE_IMAGE");
      }

      /* 💡 الربط الفعلي بموديل ذكاء اصطناعي متطور:
         سنستخدم هنا نموذج LivePortrait الشهير والخفيف القادر على بث الروح في الصور وتحريك الوجوه بدقة
      */
      const prediction = await replicate.predictions.create({
        version: "fofr/live-portrait:16ef6823", // معرف الموديل المستقر على Replicate
        input: {
          source_image: uploadedImage, // يقبل رابط مباشر أو صورة مشفرة Base64 قادمة من الفرونت إند
          prompt: await enhanceAvatarPrompt(prompt || "expression driving pattern"),
        },
      });

      // 🔄 حلقة الانتظار الذكي (Polling Loop) لمتابعة ريندر الأفاتار في خوادم Replicate الخلفية
      let result = await replicate.predictions.get(prediction.id);
      while (result.status !== "succeeded" && result.status !== "failed") {
        // الانتظار لمدة ثانيتين قبل التحقق مرة أخرى لتجنب حظر الـ Rate-limit
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result = await replicate.predictions.get(prediction.id);
      }

      if (result.status === "failed") {
        throw new Error("AI_SERVER_RENDER_FAILED");
      }

      // استخراج الرابط الحقيقي النهائي للفيديو التوليدي الناتج عن الذكاء الاصطناعي
      const avatarUrl = requireOutputUrl(result.output, "Generated avatar");

      // علم العملية كـ COMPLETED لنجاح توليد الأفاتار الحقيقي للمشتركين وترسيخ خصم النقاط
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        avatar: avatarUrl, // إرسال رابط الفيديو الحقيقي للأفاتار الناطق
        demo: false,
        remainingCredits: creditResult.remainingCredits,
      });

    } catch (aiError: any) {
      // 💸 صمام الأمان: في حال فشل السيرفر الخارجي أو لم يتم رفع صورة، يتم رد النقاط فوراً لحساب العميل
      console.error("🔥 Avatar AI pipeline failed, triggering refund...", aiError);
      await refundCredits(referenceId);

      const errorMessage = aiError.message === "MISSING_SOURCE_IMAGE" 
        ? "Avatar generation requires a base seed image to be uploaded."
        : "Avatar generation failed on cloud GPUs. Your credits have been securely refunded.";

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("🔥 AVATAR API FATAL ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}