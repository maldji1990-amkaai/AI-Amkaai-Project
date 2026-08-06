import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// 🔐 هذا الملف يُطبَّق تلقائياً على كل الصفحات داخل app/admin/**
// (app/admin/page.tsx و app/admin/plans/page.tsx وأي صفحة إدارية تُضاف مستقبلاً)
// بحيث لا يقدر أي زائر غير أدمن حتى رؤية هيكل الصفحة، وليس فقط منعه من تعديل البيانات.
//
// نفس منطق التحقق المستخدم في lib/admin-auth.ts (متغير البيئة ADMIN_EMAIL)،
// لكن هنا كـ Server Component يعمل قبل عرض أي HTML، فيُحوّل المستخدم غير المصرَّح له
// فوراً بدل عرض صفحة فارغة أو رسالة خطأ بعد التحميل.

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  // ⚠️ إذا لم يكن المستخدم مسجّلاً دخوله، أو بريده لا يطابق ADMIN_EMAIL،
  // أو لم يُضبط ADMIN_EMAIL أصلاً في البيئة (بأمان نرفض بدل السماح بالخطأ)
  if (!user || !adminEmail || userEmail !== adminEmail) {
    redirect("/"); // 🔁 تحويل فوري للصفحة الرئيسية - لا تظهر أي محتوى إداري إطلاقاً
  }

  return <>{children}</>;
}
