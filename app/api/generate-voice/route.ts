import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import Replicate from "replicate";
import { requireOutputUrl } from "@/lib/ai-output";
import { db } from "@/lib/db";

// تهيئة محرك اتصال Replicate للذكاء الاصطناعي
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const MAX_ENHANCED_VOICE_TEXT_LENGTH = 12000;

async function autoEnhanceVoiceText(text: string) {
  // AUTO_ENHANCE_PROMPT=false keeps the original voice text untouched.
  if (process.env.AUTO_ENHANCE_PROMPT === "false") {
    return { enhancedText: text, provider: "disabled" };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Auto Enhance must never block voice generation.
  if (!apiKey) {
    return { enhancedText: text, provider: "fallback" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

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
                  "You are AmkaAI's automatic voice-script enhancer.",
                  "Improve the text only for natural text-to-speech delivery.",
                  "PRESERVE EVERY ORIGINAL WORD EXACTLY.",
                  "Do not add words, remove words, translate, summarize, rewrite, or change the meaning.",
                  "Do not invent dialogue, facts, names, emotions, or events.",
                  "You may only improve punctuation, capitalization, paragraph breaks, and harmless spacing so the voice model can speak the same text naturally.",
                  "Return ONLY the improved text. No heading, explanation, quotation marks, or markdown.",
                ].join("\n"),
              },
            ],
          },
          {
            role: "user",
            content: [{ type: "input_text", text }],
          },
        ],
        max_output_tokens: 1200,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { enhancedText: text, provider: "fallback" };
    }

    const outputText =
      typeof data?.output_text === "string" ? data.output_text.trim() : "";

    if (!outputText || outputText.length > MAX_ENHANCED_VOICE_TEXT_LENGTH) {
      return { enhancedText: text, provider: "fallback" };
    }

    return { enhancedText: outputText, provider: "openai" };
  } catch (error) {
    console.error("AUTO_ENHANCE_VOICE_TEXT_FAILED", error);
    return { enhancedText: text, provider: "fallback" };
  } finally {
    clearTimeout(timeout);
  }
}

async function persistVoiceResult(args: {
  userId: string;
  generationId: string | null;
  sceneId: string | null;
  voiceProfileId: string | null;
  audioUrl: string;
  outputUrl: string;
  lipSyncVideoUrl: string | null;
  enhancedText: string;
  enhanceProvider: string;
}) {
  const { userId, generationId, sceneId, voiceProfileId, audioUrl, outputUrl, lipSyncVideoUrl, enhancedText, enhanceProvider } = args;
  const now = new Date().toISOString();

  if (sceneId) {
    await db.scene.update({
      where: { id: sceneId },
      data: { audioUrl },
    });
  }

  if (voiceProfileId) {
    await db.voiceProfile.update({
      where: { id: voiceProfileId },
      data: { audioUrl },
    });
  }

  if (generationId) {
    const generation = await db.generation.findFirst({
      where: { id: generationId, userId },
      select: { metadata: true },
    });
    if (!generation) throw new Error("GENERATION_NOT_FOUND");

    const meta = generation.metadata && typeof generation.metadata === "object"
      ? { ...(generation.metadata as Record<string, unknown>) }
      : {};

    await db.generation.update({
      where: { id: generationId },
      data: {
        metadata: {
          ...meta,
          voiceAudioUrl: audioUrl,
          voiceOutputUrl: outputUrl,
          lipSyncVideoUrl: lipSyncVideoUrl || null,
          voiceProfileId: voiceProfileId || meta.voiceProfileId || null,
          sceneId: sceneId || meta.sceneId || null,
          voiceGeneratedAt: now,
          voiceEnhanceProvider: enhanceProvider,
          voiceEnhancedText: enhancedText,
        },
      },
    });
  }
}

export async function POST(request: Request) {
  // 🎯 إنشاء معرف فريد للعملية لمتابعة حجز النقاط وإرجاعها تلقائياً في حال الفشل
  const referenceId = `voc_${crypto.randomUUID()}`;

  try {
    console.log("🚀 HEYGEN-STYLE VOICE CLONE & LIP-SYNC API HIT");

    // 🔒 التحقق من هوية المستخدم عبر Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 📦 استقبال المعطيات من واجهة المستخدم الفخمة (Synthesis Hub)
    const body = await request.json();
    let {
      text,
      voiceSampleUrl,
      language,
      targetAvatarVideo,
      generationId: requestedGenerationId,
      sceneId: requestedSceneId,
      voiceProfileId: requestedVoiceProfileId,
    } = body;

    if (!text) {
      return NextResponse.json({ error: "الرجاء كتابة النص المراد تحويله لنطق بشري حقيقي" }, { status: 400 });
    }

    // 👤 جلب بيانات المستخدم التحقق من وجوده في قاعدة البيانات
    const user = await getOrCreateUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

    const generationId = typeof requestedGenerationId === "string" && requestedGenerationId.trim()
      ? requestedGenerationId.trim()
      : null;
    const sceneId = typeof requestedSceneId === "string" && requestedSceneId.trim()
      ? requestedSceneId.trim()
      : null;
    const voiceProfileId = typeof requestedVoiceProfileId === "string" && requestedVoiceProfileId.trim()
      ? requestedVoiceProfileId.trim()
      : null;

    // Optional persistence context. When these IDs are not supplied, the existing
    // standalone voice-generation behaviour remains unchanged.
    let linkedGeneration: { id: string; userId: string; projectId: string | null; metadata: unknown } | null = null;
    if (generationId) {
      linkedGeneration = await db.generation.findFirst({
        where: { id: generationId, userId: user.id },
        select: { id: true, userId: true, projectId: true, metadata: true },
      });
      if (!linkedGeneration) {
        return NextResponse.json({ error: "GENERATION_NOT_FOUND" }, { status: 404 });
      }
    }

    if (sceneId) {
      const scene = await db.scene.findFirst({
        where: { id: sceneId, project: { userId: user.id } },
        select: { id: true, projectId: true },
      });
      if (!scene) return NextResponse.json({ error: "SCENE_NOT_FOUND" }, { status: 404 });
    }

    if (voiceProfileId) {
      const voiceProfile = await db.voiceProfile.findFirst({
        where: { id: voiceProfileId, userId: user.id },
        select: { id: true },
      });
      if (!voiceProfile) return NextResponse.json({ error: "VOICE_PROFILE_NOT_FOUND" }, { status: 404 });
    }

    /*
     * AUTO ENHANCE
     *
     * For voice generation we must NOT invent or rewrite spoken content.
     * The enhancer only improves punctuation/formatting while preserving
     * every original word. Replicate, credits, cloning and lip-sync stay intact.
     */
    const { enhancedText, provider: enhanceProvider } =
      await autoEnhanceVoiceText(text);

    text = enhancedText;

    //////////////////////////////////////////////////
    // 💸 USE CREDITS & SUBSCRIPTION CHECK (آمن وصارم)
    //////////////////////////////////////////////////
    let creditResult;
    try {
      creditResult = await useCredits(user.id, "voice", { reference: referenceId });
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
      // إرسال ملف صوتي تجريبي سريع لتوفير موارد السيرفر الحقيقية
      const demoAudio = "https://actions.google.com/sounds/v1/ambiences/morning_birds.ogg";
      
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        outputUrl: demoAudio,
        demo: true,
        remainingCredits: creditResult.remainingCredits,
      });
    }

    //////////////////////////////////////////////////
    // 💎 paid plans (REAL HEYGEN-STYLE AI ACTIVE)
    //////////////////////////////////////////////////
    try {
      let finalOutputUrl = "";
      let generatedAudioUrl = "";
      let lipSyncVideoUrl: string | null = null;

      // 🎤 المسار الأول: إذا رفع المشترك عينة صوت حقيقية (Instant Voice Cloning)
      if (voiceSampleUrl) {
        // استدعاء موديل XTTS-v2 العالمي المتخصص في نسخ البصمة الصوتية والتحدث بها بكل لغات العالم
        const prediction = await replicate.predictions.create({
          version: "lucataco/xtts-v2:684bc385", 
          input: {
            text: text,
            speaker: voiceSampleUrl, // رابط ملف بصمة صوت العميل المرفوع من الواجهة
            language: language || "ar", // دعم اللغة العربية بطلاقة وبنفس النبرة المنسوخة
          },
        });

        // 🔄 حلقة الانتظار الذكي (Polling)
        let result = await replicate.predictions.get(prediction.id);
        while (result.status !== "succeeded" && result.status !== "failed") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          result = await replicate.predictions.get(prediction.id);
        }

        if (result.status === "failed") throw new Error("VOICE_CLONING_PIPELINE_FAILED");
        finalOutputUrl = requireOutputUrl(result.output, "Generated voice");
        generatedAudioUrl = finalOutputUrl
      } 
      // 🗣️ المسار الثاني: توليد نطق بشري احترافي قياسي من نصوص (Text-to-Speech) في حال عدم رفع عينة
      else {
        const prediction = await replicate.predictions.create({
          version: "aoisynth/elevenlabs-tts:standard", 
          input: { 
            text: text, 
            voice_id: "21m00Tcm4TlvDq8ikWAM" // صوت احترافي افتراضي عالي الجودة
          }, 
        });

        let result = await replicate.predictions.get(prediction.id);
        while (result.status !== "succeeded" && result.status !== "failed") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          result = await replicate.predictions.get(prediction.id);
        }

        if (result.status === "failed") throw new Error("TTS_ENGINE_FAILED");
        finalOutputUrl = requireOutputUrl(result.output, "Generated voice");
        generatedAudioUrl = finalOutputUrl;
      }

      //////////////////////////////////////////////////////////////////
      // 🔗 السحر الحقيقي (HeyGen Lip-Sync Integration)
      // إذا قام المشترك بتفعيل دمج الصوت المولد مع ملامح شفايف الأفاتار
      //////////////////////////////////////////////////////////////////
      if (targetAvatarVideo && finalOutputUrl) {
        console.log("🔄 Active Lip-Sync Layer: Merging cloned voice with target face...");
        
        // استدعاء موديل Wav2Lip المتطور لدمج الصوت المستنسخ مع فيديو الأفاتار الصامت بدقة تزامنية عالية
        const lipSyncPrediction = await replicate.predictions.create({
          version: "cjwbw/wav2lip:19c8d3d3", 
          input: {
            face: targetAvatarVideo, // رابط فيديو الأفاتار الصامت القادم من الفرونت إند
            audio: finalOutputUrl,    // رابط البصمة الصوتية المولدة في الخطوة السابقة
          },
        });

        // 🛠️ تم حل المشكلة هنا: استخدام كائن replicate الرئيسي لجلب الـ Prediction بدقة وعزل تعارض الـ Types
        let syncResult = await replicate.predictions.get(lipSyncPrediction.id);
        while (syncResult.status !== "succeeded" && syncResult.status !== "failed") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          syncResult = await replicate.predictions.get(lipSyncPrediction.id);
        }

        // إذا نجحت عملية المزامنة الحركية، يتحول المخرج النهائي ليكون فيديو ناطق فخم بدلاً من مجرد صوت
        if (syncResult.status === "succeeded") {
          lipSyncVideoUrl = requireOutputUrl(syncResult.output, "Lip-sync output");
          finalOutputUrl = lipSyncVideoUrl;
        }
      }

      if (generatedAudioUrl && (generationId || sceneId || voiceProfileId)) {
        await persistVoiceResult({
          userId: user.id,
          generationId,
          sceneId,
          voiceProfileId,
          audioUrl: generatedAudioUrl,
          outputUrl: finalOutputUrl,
          lipSyncVideoUrl,
          enhancedText,
          enhanceProvider,
        });
      }

      // 🎯 تأكيد نجاح العملية بالكامل وترسيخ خصم النقاط في قاعدة البيانات
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        outputUrl: finalOutputUrl,
        audioUrl: generatedAudioUrl || null,
        voiceAudioUrl: generatedAudioUrl || null,
        lipSyncVideoUrl,
        generationId,
        sceneId,
        voiceProfileId,
        demo: false,
        remainingCredits: creditResult.remainingCredits,
        autoEnhanced: enhancedText !== body.text,
        enhanceProvider,
        originalText: body.text,
        enhancedText,
      });

    } catch (aiError) {
      // 💸 [صمام الأمان لـ سحب الرصيد] استرداد مالي فوري للنقاط في حال حدوث أي مشكلة في السيرفر الخارجي
      console.error("🔥 Voice pipeline internal failure, triggering refund:", aiError);
      await refundCredits(referenceId);
      return NextResponse.json({ error: "Failed to process AI Voice synthesis nodes. Your credits have been securely refunded." }, { status: 502 });
    }

  } catch (error) {
    console.error("🔥 FATAL ERROR IN GENERATE VOICE API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}