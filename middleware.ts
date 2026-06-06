import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 🎯 تحديد المسارات العامة المتاحة للجميع دون الحاجة لتسجيل الدخول
const isPublicRoute = createRouteMatcher([
  "/",                      // صفحة الهبوط (Landing Page)
  "/sign-in(.*)",           // صفحة تسجيل الدخول
  "/sign-up(.*)",           // صفحة إنشاء حساب جديد
  "/pricing",               // صفحة خطط الأسعار
  "/complete-payment",      // صفحة نجاح الدفع بعد ليمون سكويزي
  "/api/webhook(.*)",       // تأمين واستثناء الـ Webhooks
]);

// ⚡ تحديد مسارات الـ API لعدم تفعيل التوجيه الذكي (Smart Redirect) عليها
const isApiRoute = createRouteMatcher(["/(api|trpc)(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const currentUrl = new URL(req.url);

  // 1. 🛡️ حماية المسارات الخاصة (Dashboard, Generation, etc.)
  if (!isPublicRoute(req)) {
    await auth.protect();
    return NextResponse.next();
  }

  // 2. 🛑 حماية إضافية: إذا كان الطلب مسار API عام (مثل الـ Webhook أو الـ Checkout)، نمرره فوراً 
  // دون استدعاء دالة auth() بالأسفل لتجنب خطأ الـ 500 والـ Session Timeout أونلاين
  if (isApiRoute(req)) {
    return NextResponse.next();
  }

  // 3. 🔄 توجيه ذكي (Smart Redirection) للمسارات العامة الخاصة بالمتصفح فقط (Pages)
  const { userId } = await auth();

  // إذا كان المستخدم مسجل دخوله وحاول العودة لصفحات التسجيل
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