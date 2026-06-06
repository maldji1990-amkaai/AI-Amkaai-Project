import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 🎯 تحديد المسارات العامة (متاحة للجميع دون تسجيل دخول)
const isPublicRoute = createRouteMatcher([
  "/",                      // صفحة الهبوط
  "/sign-in(.*)",           // تسجيل الدخول
  "/sign-up(.*)",           // إنشاء حساب
  "/pricing",               // الأسعار
  "/complete-payment",      // صفحة نجاح الدفع
  "/api/webhook(.*)",       // مسار الـ Webhooks القادم من ليمون سكويزي
]);

// ⚡ تحديد مسارات الـ API (بما فيها الـ checkout) لمنع التوجيه الذكي لصفحات الواجهة
const isApiRoute = createRouteMatcher(["/(api|trpc)(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const currentUrl = new URL(req.url);

  // 1. إذا كان المسار يخص الـ API (مثل /api/checkout)، نتركه يمر بسلام لتقوم دالة auth() داخله بعملها
  if (isApiRoute(req)) {
    return NextResponse.next();
  }

  // 2. 🛡️ حماية المسارات الخاصة باللوحة (Dashboard, etc.) إذا كان المستخدم غير مسجل
  if (!isPublicRoute(req)) {
    await auth.protect();
    return NextResponse.next();
  }

  // 3. 🔄 التوجيه الذكي (Smart Redirection) لصفحات التوثيق فقط
  const { userId } = await auth();

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
    // ⚡ فحص جميع مسارات الـ API و tRPC دائماً لكي تتعرف Clerk عليها أونلاين
    '/(api|trpc)(.*)',
  ],
};