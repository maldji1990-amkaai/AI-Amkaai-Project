import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { LIMITS, FEATURES } from "@/lib/config";
import { getUserPlan } from "@/lib/subscription";
import Replicate from "replicate";
import { v2 as cloudinary } from "cloudinary";

// تهيئة محرك اتصال Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// تهيئة Cloudinary (نفس الإعدادات المستخدمة في lib/upload.ts)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// 🆕 مدة الفيديو بالثواني حسب الباقة (تُستخدم لحساب النقاط المستهلكة بدقة عبر useCredits)
// ⚠️ قيم مؤقتة قابلة للتعديل لاحقاً من لوحة الإدارة
const PLAN_VIDEO_DURATION: Record<string, number> = {
  trial: 5,
  monthly: 8,
  quarterly: 8,
  biannually: 10,
  business: 120, // حتى دقيقتين كما هو مخطط
};

export async function POST(req: Request) {
  // 1. إنشاء معرف فريد للعملية لتتبع الاستهلاك والـ Refund تلقائياً
  const referenceId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    // 🔒 التحقق من هوية المستخدم عبر Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ⚡ التحقق من الـ Feature Flag (هل ميزة الفيديو مفعلة في الموقع؟)
    if (!FEATURES.enableVideoQueue) {
      return NextResponse.json({ error: "Video generation is temporarily disabled" }, { status: 503 });
    }

    // 📦 استقبال وقراءة البيانات القادمة من واجهة المستخدم (الـ Dashboard Control)
    const body = await req.json();
    const { prompt, aspectRatio, creativity, cameraMotion } = body;

    // 🔒 [أمان] نجيب باقة المستخدم الحقيقية من قاعدة البيانات مباشرة — لا نثق أبداً بأي "userPlan" قادم من الفرونت إند
    const userPlan = await getUserPlan(userId);
    const normalizedPlanForModel = (userPlan || "").toString().toLowerCase();

    // 🔐 التحقق من قيود الـ Prompt الأمنية المحددة في ملف الـ Config
    if (!prompt || prompt.length < LIMITS.minPromptLength) {
      return NextResponse.json({ error: `Prompt too short. Minimum ${LIMITS.minPromptLength} characters.` }, { status: 400 });
    }
    if (prompt.length > LIMITS.maxPromptLength) {
      return NextResponse.json({ error: `Prompt too long. Maximum ${LIMITS.maxPromptLength} characters.` }, { status: 400 });
    }

    // 🆕 تحديد مدة الفيديو المستحقة لهذه الباقة، لتُخصم النقاط بدقة (خصوصاً لباقة Business بمدة أطول بكثير)
    const durationForThisPlan = PLAN_VIDEO_DURATION[normalizedPlanForModel] ?? PLAN_VIDEO_DURATION.trial;

    // 🛡️ محاولة حجز النقاط وفحص اشتراك PayPal — الآن مع تمرير duration الصحيح حسب الباقة
    const creditResult = await useCredits(userId, "video", {
      reference: referenceId,
      duration: durationForThisPlan,
    });

    try {
      //////////////////////////////////////////////////////////////////
      // 🎬 إعداد نظام النماذج الذكي والديناميكي لحماية الهامش الربحي لـ Amkaai
      //////////////////////////////////////////////////////////////////

      let modelIdentifier = "";
      let modelInput: Record<string, any> = {};

      // 🆕 نظام الموديل الهجين (Hybrid):
      // - الباقات ذات الجودة 1080p (business/biannually/quarterly) → wan-2.5-t2v العادي
      //   (الموديل الوحيد الذي يدعم 1080p فعلياً على Replicate حتى الآن)
      // - الباقات ذات الجودة 720p (trial/monthly) → wan-2.5-t2v-fast
      //   أرخص وأسرع، بدون أي فرق ملموس بالجودة عند 720p تحديداً
      const HIGH_RES_MODEL = "wan-video/wan-2.5-t2v-14b";
      const FAST_MODEL = "wan-video/wan-2.5-t2v-fast";

      if (normalizedPlanForModel === "business") {
        // 🆕 أقوى باقة: 1080p + حتى دقيقتين + أعلى جودة sampling
        modelIdentifier = HIGH_RES_MODEL;
        modelInput = {
          prompt: prompt,
          size: aspectRatio === "1:1" ? "1080*1080" : (aspectRatio === "9:16" ? "1080*1920" : "1920*1080"),
          frame_num: 81, // ⚠️ TODO: قد يحتاج تعديل فعلي حسب حدود الموديل لدعم مدة دقيقتين كاملة — يُراجع مع Replicate docs
          advanced_sampling: true,
          cfg_scale: creativity ? creativity * 10 : 7.5,
        };
      } else if (normalizedPlanForModel === "biannually" || normalizedPlanForModel === "quarterly") {
        // ⭐ الباقتان الفصلية والنصف سنوية: 1080p
        modelIdentifier = HIGH_RES_MODEL;
        modelInput = {
          prompt: prompt,
          size: aspectRatio === "1:1" ? "1080*1080" : (aspectRatio === "9:16" ? "1080*1920" : "1920*1080"),
          frame_num: 81,
          advanced_sampling: true,
          cfg_scale: creativity ? creativity * 10 : 7.5,
        };
      } else if (normalizedPlanForModel === "monthly") {
        // 🆕 باقة Monthly: 720p بدون علامة مائية، عبر الموديل السريع/الأرخص
        modelIdentifier = FAST_MODEL;
        modelInput = {
          prompt: prompt,
          size: aspectRatio === "1:1" ? "720*720" : (aspectRatio === "9:16" ? "720*1280" : "1280*720"),
          frame_num: 81,
        };
      } else {
        // 💰 باقة التجربة (trial): 720p عبر الموديل السريع/الأرخص لأعلى هامش ربح + علامة مائية لاحقاً
        modelIdentifier = FAST_MODEL;
        modelInput = {
          prompt: prompt,
          size: aspectRatio === "1:1" ? "720*720" : (aspectRatio === "9:16" ? "720*1280" : "1280*720"),
          frame_num: 81,
        };
      }

      // 💥 استدعاء سيرفر الذكاء الاصطناعي الفعلي
      const output = await replicate.run(
        modelIdentifier as `${string}/${string}`,
        { input: modelInput }
      );

      if (!output) {
        throw new Error("AI_SERVER_RENDER_FAILED");
      }

      const rawVideoUrl = Array.isArray(output) ? output[0] : output;

      // 💧 [علامة مائية] فقط لمستخدمي التجربة (trial) - شفافية 40% - نص "AMKAAI" عمودي
      // ✅ مصحح: أُزيل شرط "free" لأن FREE لم تعد قيمة موجودة في enum (TRIAL و FREE أصبحتا باقة واحدة)
      let finalVideoUrl = rawVideoUrl;

      if (normalizedPlanForModel === "trial") {
        try {
          const watermarked = await cloudinary.uploader.upload(rawVideoUrl, {
            resource_type: "video",
            folder: "generated-trial",
            transformation: [
              {
                overlay: {
                  font_family: "Arial",
                  font_size: 36,
                  font_weight: "bold",
                  text: "AMKAAI.NET",
                },
                gravity: "east",
                x: 24,
                angle: -90,
                color: "white",
                opacity: 40,
              },
            ],
          });
          finalVideoUrl = watermarked.secure_url;
        } catch (watermarkError) {
          console.error("🔥 Watermark overlay failed:", watermarkError);
        }
      }

      // 🎯 تثبيت نجاح العملية في قاعدة البيانات
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        videoUrl: finalVideoUrl,
        remainingCredits: creditResult.remainingCredits,
      });

    } catch (aiError) {
      console.error("🔥 AI Generation Call Failed, triggering automatic credit refund:", aiError);
      await refundCredits(referenceId);

      return NextResponse.json({ error: "Failed to communicate with AI generation engine. Your credits have been securely refunded." }, { status: 502 });
    }

  } catch (error: any) {
    console.error("🔥 GENERATE VIDEO ROUTE ERROR:", error);

    if (error.message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
      return NextResponse.json({ error: "Your subscription has expired or is past due. Please check your billing dashboard." }, { status: 403 });
    }
    if (error.message === "NOT_ENOUGH_CREDITS") {
      return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan to generate videos." }, { status: 402 });
    }

    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
