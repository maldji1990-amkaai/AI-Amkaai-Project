import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { demoVideos } from "@/lib/demo"; // يفضل استخدام روابط فيديو ديمو هنا للمشترك المجاني
import { PlanType } from "@prisma/client";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  const referenceId = `img2vid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    console.log("🚀 HEYGEN-STYLE IMAGE-TO-VIDEO API HIT");

    // 1️⃣ التحقق من الهوية عبر Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // استقبال البيانات (الوصف النصي للحركة + الصورة المراد تحريكها)
    const { prompt, uploadedImage, aspectRatio } = await request.json();

    if (!uploadedImage) {
      return NextResponse.json({ error: "الرجاء رفع صورة أولاً لتحويلها إلى فيديو (Image to Video)" }, { status: 400 });
    }

    // 2️⃣ جلب بيانات المستخدم من قاعدة البيانات
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

    // 3️⃣ سحب وخصم النقاط بشكل آمن وصارم
    let creditResult;
    try {
      creditResult = await useCredits(user.id, "video", { reference: referenceId }); // استخدام كلفة الفيديو
    } catch (err: any) {
      if (err.message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
        return NextResponse.json({ error: "Your subscription has expired. Please check your billing dashboard." }, { status: 403 });
      }
      return NextResponse.json({ error: err.message || "Not enough credits" }, { status: 402 });
    }

    // 4️⃣ وضع المحاكاة للمستخدمين المجانيين (FREE DEMO MODE)
    if (user.plan === PlanType.FREE) {
      // إرجاع فيديو ديمو عشوائي جاهز لعدم استهلاك سيرفرات الـ GPU الحقيقية مجاناً
      const fallbackVideo = demoVideos ? demoVideos[Math.floor(Math.random() * demoVideos.length)] : "https://replicate.delivery/pbxt/IJ9ZJ6cOsnwUuH1F6gA8G...";
      
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        videoUrl: fallbackVideo,
        demo: true,
        remainingCredits: creditResult.remainingCredits,
      });
    }

    // 5️⃣ تشغيل الـ Real AI الفعلي للمشتركين المدفوعين (PRO / PREMIUM)
    try {
      /*
        توليد HeyGen-Style حقيقي: نرسل الصورة كـ Seed Image ومعه الـ Prompt لتوجيه الحركة
        باستخدام موديل Luma Dream Machine المتطور على Replicate القادر على تحويل الصور الثابتة لفيديوهات حية.
      */
      const prediction = await replicate.predictions.create({
        version: "maxwell-in-the-cloud/luma-dream-machine", 
        input: {
          image: uploadedImage, // الصورة المرفوعة من الواجهة (رابط أو Base64)
          prompt: prompt || "Bring this image to life, natural cinematic movement, high quality",
          aspect_ratio: aspectRatio || "16:9",
        },
      });

      // الانتظار الذكي (Polling) داخل السيرفر حتى انتهاء معالجة الفيديو بالكامل
      let result = await replicate.predictions.get(prediction.id);
      while (result.status !== "succeeded" && result.status !== "failed") {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // الانتظار 3 ثوانٍ بين كل فحص
        result = await replicate.predictions.get(prediction.id);
      }

      if (result.status === "failed") {
        throw new Error("LUMA_RENDER_NODE_FAILED");
      }

      // استخراج رابط الفيديو النهائي المولّد بنجاح
      const finalVideoUrl = Array.isArray(result.output) ? result.output[0] : result.output;

      // تثبيت عملية الخصم بنجاح
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        videoUrl: finalVideoUrl,
        demo: false,
        remainingCredits: creditResult.remainingCredits,
      });

    } catch (aiError: any) {
      // صمام الأمان: رد النقاط فوراً للعميل في حال حدوث أي خطأ برمي في خوادم المعالجة
      console.error("🔥 Image-to-Video pipeline failed, rolling back credits:", aiError);
      await refundCredits(referenceId);

      return NextResponse.json(
        { error: "فشلت عملية تحويل الصورة إلى فيديو في خوادم الـ GPU. تم إعادة نقاطك إلى حسابك بأمان." },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("🔥 FATAL ERROR IN IMAGE-TO-VIDEO API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}