import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 🎯 تحديد المسارات العامة المتاحة للجميع (الزوار والمشتركين) دون الحاجة لتسجيل الدخول
const isPublicRoute = createRouteMatcher([
  "/",                      // صفحة الهبوط (Landing Page)
  "/sign-in(.*)",           // صفحة تسجيل الدخول
  "/sign-up(.*)",           // صفحة إنشاء حساب جديد
  "/pricing",               // صفحة خطط الأسعار
  "/complete-payment",      // صفحة نجاح الدفع بعد ليمون سكويزي
  
  // 🍋 تأمين الـ Webhooks (تأكد من مطابقتها لكل مسارات الـ API العامة لديك)
  "/api/webhook(.*)",       // تم تعديلها للمفرد والجمع لتشمل /api/webhook و /api/webhook/lemon-squeezy
]);

export default clerkMiddleware(async (auth, req) => {
  const currentUrl = new URL(req.url);

  // 1. 🛡️ حماية المسارات الخاصة (Dashboard, Generation, etc.)
  // إذا كان المسار خاصًا والمستخدم غير مسجل، نقوم بحمايته فوراً
  if (!isPublicRoute(req)) {
    await auth.protect();
    return NextResponse.next(); // تأكيد إنهاء الـ middleware هنا للمسارات المحمية غير المسجلة
  }

  // 2. 🔄 توجيه ذكي (Smart Redirection) للمسارات العامة
  // نجلب الـ userId فقط عند الحاجة لتجنب أي استدعاء مبكر قبل الحماية
  const { userId } = await auth();

  // إذا كان المستخدم "مسجل دخوله بالفعل" وحاول العودة لصفحات التسجيل (sign-in أو sign-up)
  if (userId && (currentUrl.pathname.startsWith("/sign-in") || currentUrl.pathname.startsWith("/sign-up"))) {
    const dashboardUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // 🛡️ الـ RegEx الرسمي والأحدث من Clerk لمنع فحص الملفات الثابتة والأيقونات لسرعة الاستجابة
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // ⚡ فحص جميع مسارات الـ API و tRPC دائماً
    '/(api|trpc)(.*)',
  ],
};