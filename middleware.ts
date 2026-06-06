import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 🎯 تحديد المسارات العامة (متاحة للجميع مثل صفحة الأسعار والـ Webhooks)
const isPublicRoute = createRouteMatcher([
  "/",                      // صفحة الهبوط
  "/sign-in(.*)",           // تسجيل الدخول
  "/sign-up(.*)",           // إنشاء حساب
  "/pricing",               // الأسعار
  "/complete-payment",      // صفحة نجاح الدفع
  "/api/webhook(.*)",       // الـ Webhooks من ليمون سكويزي
  "/api/checkout(.*)",      // 👈 جعل مسار الـ Checkout مساراً عاماً لكي لا تمنعه Clerk، ولكن سيمر عبر الميدلوير لتهيئته!
]);

export default clerkMiddleware(async (auth, req) => {
  const currentUrl = new URL(req.url);

  // 1. 🛡️ حماية المسارات الخاصة فقط (مثل اللوحة /dashboard)
  // إذا كان المسار ليس عاماً، نقوم بإجبار المستخدم على تسجيل الدخول
  if (!isPublicRoute(req)) {
    await auth.protect();
    return NextResponse.next();
  }

  // 2. 🔄 التوجيه الذكي (Smart Redirection) لصفحات الواجهة فقط (Pages)
  // نتحقق من وجود الجلسة فقط إذا كان المستخدم يتصفح صفحات الـ Sign-in أو Sign-up يدوياً
  if (currentUrl.pathname.startsWith("/sign-in") || currentUrl.pathname.startsWith("/sign-up")) {
    const { userId } = await auth();
    if (userId) {
      const dashboardUrl = new URL("/dashboard", req.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // 🛡️ الفلتر الرسمي من Clerk لحظر الملفات الثابتة والصور لزيادة سرعة الاستجابة
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // ⚡ إجبار الميدلوير على فحص ومعالجة كافة مسارات الـ API و tRPC (ضروري جداً لكي تعمل دالة auth)
    '/(api|trpc)(.*)',
  ],
};