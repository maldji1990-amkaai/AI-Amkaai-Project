// lib/admin-auth.ts

import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * 🔐 التحقق الموحّد من صلاحية الأدمن
 * يُستخدم في بداية كل route إداري (app/api/admin/**)
 *
 * يعتمد على متغير البيئة ADMIN_EMAIL (نفس النمط المستخدم بالفعل
 * في app/api/admin/payments و app/api/admin/reject).
 *
 * @returns { ok: true, userId, email } إذا كان المستخدم أدمن صحيح
 * @returns { ok: false, status, error } إذا فشل التحقق — يُستخدم مباشرة لإرجاع NextResponse
 */
export async function requireAdmin() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = user.emailAddresses[0]?.emailAddress;

  // ⚠️ إذا لم يكن ADMIN_EMAIL مضبوطاً في البيئة، نرفض كل الطلبات بأمان
  // (بدلاً من السماح للجميع بالخطأ لو نسي أحد ضبط المتغير في production)
  if (!adminEmail || userEmail !== adminEmail) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, userId, email: userEmail };
}
