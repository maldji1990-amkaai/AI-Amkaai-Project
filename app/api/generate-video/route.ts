import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { LIMITS, FEATURES } from "@/lib/config";
import Replicate from "replicate";

// تهيئة محرك اتصال Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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
    const { prompt, aspectRatio, creativity, cameraMotion, userPlan } = body; 
    // ملاحظة: نقوم باستقبال الـ userPlan (سواء 'trial' أو 'quarterly' أو 'biannually') الممررة من الواجهة أو قاعدة البيانات

    // 🔐 التحقق من قيود الـ Prompt الأمنية المحددة في ملف الـ Config
    if (!prompt || prompt.length < LIMITS.minPromptLength) {
      return NextResponse.json({ error: `Prompt too short. Minimum ${LIMITS.minPromptLength} characters.` }, { status: 400 });
    }
    if (prompt.length > LIMITS.maxPromptLength) {
      return NextResponse.json({ error: `Prompt too long. Maximum ${LIMITS.maxPromptLength} characters.` }, { status: 400 });
    }

    // 🛡️ محاولة حجز النقاط وفحص اشتراك Lemon Squeezy
    const creditResult = await useCredits(userId, "video", { reference: referenceId });

    try {
      
      //////////////////////////////////////////////////////////////////
      // 🎬 إعداد نظام النماذج الذكي والديناميكي لحماية الهامش الربحي لـ Amkaai
      //////////////////////////////////////////////////////////////////
      
      let modelIdentifier = "";
      let modelInput: Record<string, any> = {};

      // فحص باقة المستخدم لتحديد المحرك والجودة تلقائياً
      if (userPlan === "biannually") {
        // ⭐ الباقة الفاخرة لـ 6 أشهر: نوفر جودة هوليوود Kling v1.5 بدقة 1080p
        // نستخدم الموديل مباشرة كاسم نصي متوافق مع دالة replicate.run الحديثة والمستقرة
        modelIdentifier = "kling-ai/kling-v1.5-video";
        modelInput = {
          prompt: prompt,
          aspect_ratio: aspectRatio || "16:9",
          camera_control: cameraMotion || "static",
          cfg_scale: creativity ? creativity * 10 : 7.5,
          resolution: "1080p" // حصرية دقة الـ Full HD السينمائية هنا
        };
      } else {
        // 💰 باقة التجربة بـ 0.99$ والباقة الربع سنوية: نوفر Wan 2.5 Fast بدقة 720p لضمان أعلى هامش ربح
        modelIdentifier = "wan-video/wan-2.5-t2v-14b"; // مسار نموذج Wan الرسمي النصي المستقر عبر ريبليكيت
        modelInput = {
          prompt: prompt,
          size: aspectRatio === "1:1" ? "1024*1024" : (aspectRatio === "9:16" ? "720*1280" : "1280*720"), // تمرير أبعاد الـ 720p الذكية
          frame_num: 81, // ما يعادل حوالي 5 ثوانٍ سينمائية سريعة
          advanced_sampling: false
        };
      }

      // 💥 استدعاء سيرفر الذكاء الاصطناعي الفعلي باستخدام نظام التوليد الموحد والمضمون لـ Replicate
      // قمنا باستبدال التنبؤ المفرط بالدالة المباشرة لتفادي مشاكل الـ version hash المتقلبة
      const output = await replicate.run(
        modelIdentifier as `${string}/${string}`,
        { input: modelInput }
      );

      // في حال فشل معالجة الفيديو بداخل خوادم السيرفر الخارجي، نرفع خطأ لتشغيل الـ Refund فوراً
      if (!output) {
        throw new Error("AI_SERVER_RENDER_FAILED");
      }

      // استخراج الرابط الحقيقي والنهائي لملف الـ MP4 الناتج عن المعالجة الذكية
      const finalVideoUrl = Array.isArray(output) ? output[0] : output;

      // 🎯 تثبيت نجاح العملية في قاعدة البيانات وتحويل حالة الـ Usage من PENDING إلى COMPLETED لخصم النقاط بثبات
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        videoUrl: finalVideoUrl, // الرابط الفعلي القابل للتشغيل والتحميل في الفرونت إند
        remainingCredits: creditResult.remainingCredits,
      });

    } catch (aiError) {
      // 💸 [صمام أمان] إذا فشل سيرفر الـ AI الخارجي أو قطع الاتصال، يتم استرجاع نقاط المستخدم فوراً تلقائياً دون خسارة العميل
      console.error("🔥 AI Generation Call Failed, triggering automatic credit refund:", aiError);
      await refundCredits(referenceId);
      
      return NextResponse.json({ error: "Failed to communicate with AI generation engine. Your credits have been securely refunded." }, { status: 502 });
    }

  } catch (error: any) {
    console.error("🔥 GENERATE VIDEO ROUTE ERROR:", error);

    // معالجة الأخطاء القادمة من دالة useCredits لمنح واجهة المستخدم رسالة واضحة
    if (error.message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
      return NextResponse.json({ error: "Your subscription has expired or is past due. Please check your billing dashboard." }, { status: 403 });
    }
    if (error.message === "NOT_ENOUGH_CREDITS") {
      return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan to generate videos." }, { status: 402 });
    }

    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}