import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { PlanType } from "@prisma/client";
import Replicate from "replicate";

// تهيئة محرك اتصال Replicate للذكاء الاصطناعي
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  // 🎯 إنشاء معرف فريد للعملية لمتابعة حجز النقاط وإرجاعها تلقائياً في حال الفشل
  const referenceId = `voc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    console.log("🚀 HEYGEN-STYLE VOICE CLONE & LIP-SYNC API HIT");

    // 🔒 التحقق من هوية المستخدم عبر Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 📦 استقبال المعطيات من واجهة المستخدم الفخمة (Synthesis Hub)
    const body = await request.json();
    const { text, voiceSampleUrl, language, targetAvatarVideo } = body;

    if (!text) {
      return NextResponse.json({ error: "الرجاء كتابة النص المراد تحويله لنطق بشري حقيقي" }, { status: 400 });
    }

    // 👤 جلب بيانات المستخدم التحقق من وجوده في قاعدة البيانات
    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          clerkId: userId,
          credits: 10,
          plan: PlanType.FREE,
        },
      });
    }

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
    if (user.plan === PlanType.FREE) {
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
    // 💎 PRO / PREMIUM (REAL HEYGEN-STYLE AI ACTIVE)
    //////////////////////////////////////////////////
    try {
      let finalOutputUrl = "";

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
        finalOutputUrl = result.output; // رابط ملف الـ WAV المستنسخ الحقيقي
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
        finalOutputUrl = result.output;
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

        let syncResult = await lipSyncPrediction.get(lipSyncPrediction.id);
        while (syncResult.status !== "succeeded" && syncResult.status !== "failed") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          syncResult = await lipSyncPrediction.get(lipSyncPrediction.id);
        }

        // إذا نجحت عملية المزامنة الحركية، يتحول المخرج النهائي ليكون فيديو ناطق فخم بدلاً من مجرد صوت
        if (syncResult.status === "succeeded") {
          finalOutputUrl = syncResult.output;
        }
      }

      // 🎯 تأكيد نجاح العملية بالكامل وترسيخ خصم النقاط في قاعدة البيانات
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        outputUrl: finalOutputUrl, // سيعود برابط فيديو متكامل أو ملف صوتي فخم حسب الخيارات المفعلة
        demo: false,
        remainingCredits: creditResult.remainingCredits,
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