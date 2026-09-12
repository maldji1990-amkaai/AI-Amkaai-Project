import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { demoVideos } from "@/lib/demo"; // يفضل استخدام روابط فيديو ديمو هنا للمشترك المجاني
import { db } from "@/lib/db";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// ⚠️ هذا المسار لا ينتظر انتهاء التوليد داخل نفس الطلب (كان سابقاً while-loop
// يستهلك وقت التنفيذ الأقصى المسموح على منصات serverless مثل Vercel ويؤدي
// لـ Timeout على الفيديوهات الأطول). الآن: ننشئ الـ prediction فقط ونرجّع
// Generation ID فوراً، والعميل يستطلع النتيجة عبر /api/generate-image/status.
export async function POST(request: Request) {
  const referenceId = `img2vid_${crypto.randomUUID()}`;

  try {
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
    const user = await getOrCreateUser(userId);
    if (!user) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

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

    // 4️⃣ وضع المحاكاة للمستخدمين المجانيين (FREE DEMO MODE) — هذا المسار لا
    // يستدعي أي مزود خارجي لذلك يبقى متزامناً وآمناً بدون خطر Timeout.
    if (user.plan === "TRIAL") {
      const fallbackVideo = Array.isArray(demoVideos) && demoVideos.length > 0
        ? demoVideos[Math.floor(Math.random() * demoVideos.length)]
        : null;
      if (!fallbackVideo) {
        await refundCredits(referenceId);
        return NextResponse.json({ error: "Demo video is temporarily unavailable. Your credits were refunded." }, { status: 503 });
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

    // 5️⃣ إنشاء طلب التوليد الحقيقي لدى Replicate فقط (بدون انتظار داخل نفس الطلب)
    try {
      const prediction = await replicate.predictions.create({
        version: "maxwell-in-the-cloud/luma-dream-machine",
        input: {
          image: uploadedImage, // الصورة المرفوعة من الواجهة (رابط أو Base64)
          prompt: prompt || "Bring this image to life, natural cinematic movement, high quality",
          aspect_ratio: aspectRatio || "16:9",
        },
      });

      const generation = await db.generation.create({
        data: {
          userId: user.id,
          type: "IMAGE_TO_VIDEO",
          prompt: prompt || null,
          status: "PROCESSING",
          metadata: {
            referenceId,
            predictionId: prediction.id,
            aspectRatio: aspectRatio || "16:9",
          },
        },
      });

      return NextResponse.json({
        success: true,
        status: "processing",
        generationId: generation.id,
        demo: false,
        remainingCredits: creditResult.remainingCredits,
      });
    } catch (aiError: any) {
      // صمام الأمان: رد النقاط فوراً للعميل في حال فشل إنشاء الطلب لدى المزود
      console.error("🔥 Image-to-Video request creation failed, rolling back credits:", aiError);
      await refundCredits(referenceId);

      return NextResponse.json(
        { error: "فشل إنشاء طلب تحويل الصورة إلى فيديو. تم إعادة نقاطك إلى حسابك بأمان." },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("🔥 FATAL ERROR IN IMAGE-TO-VIDEO API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
