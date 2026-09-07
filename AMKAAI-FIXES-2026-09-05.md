# AMKAAI — إصلاحات 2026-09-05

## ما تم إصلاحه في هذه الدفعة

- توحيد إنشاء المستخدم عبر `lib/getUser.ts` وإلغاء قيم Credits المتضاربة عند الإنشاء.
- إضافة `lib/billing.ts` كمصدر مركزي لمفاتيح الخطط، تحويلها إلى Prisma enum، الأسعار، Credits، ومدة الاشتراك.
- إصلاح `useCredits()` بحيث لا يسمح بخطة مدفوعة بدون Subscription فعّال.
- إضافة `CreditTransaction` كدفتر حركات Credits، مع تسجيل الاستخدام والاسترجاع ومنح Credits.
- منع double-credit في PayPal عبر ربط منح Credits بسجل الدفع/مرجع idempotent.
- PayPal: عدم منح Credits للخطط المدفوعة عند ACTIVATED؛ المنح يتم عند الدفع المكتمل، بينما Trial له grant مستقل.
- إضافة حماية من إنشاء اشتراك PayPal ثانٍ عندما يوجد اشتراك active/pending.
- توحيد منطق PayPal live/sandbox في الإلغاء.
- إصلاح cancellation: الإلغاء يصبح `cancelAtPeriodEnd` مع استمرار الوصول حتى نهاية الفترة.
- دعم إلغاء الاشتراكات اليدوية أيضاً.
- إصلاح manual payment: السعر الأساسي للخطة مشتق من السيرفر، وإضافة `expectedAmount` للتحقق.
- إصلاح verify-payment: OCR لم يعد يفعّل الاشتراك أو يمنح Credits تلقائياً؛ يبقى الطلب Pending ليتم اعتماده ذرياً من admin approval.
- إصلاح مدة الاشتراك اليدوي: Monthly=1 شهر، Quarterly=3 أشهر، Biannual=6 أشهر.
- تأمين NOWPayments: fail-closed عند غياب secret، رفض الخطط غير المعروفة، والتحقق من السعر للـ USD/USDT.
- ربط NOWPayments بسجل Payment + Subscription + Credit Ledger.
- إضافة `/api/credits` وإزالة الاعتماد على رصيد وهمي 240 في الواجهات.
- توحيد `/api/user` ليعيد الرصيد وحالة entitlement الحقيقية.
- إضافة صفحة `/dashboard/billing` لتاريخ المدفوعات.
- إصلاح `/billing/pending` ليستخدم `COMPLETED` بدلاً من `APPROVED`.
- حماية `/api/generate-video/stream` بالـ Clerk وownership.
- اعتماد `/dashboard/generate` كواجهة Video Generator الرسمية.
- تحويل `/generate` و`/ai-video` القديمتين إلى redirect للواجهة الحديثة.
- زر AI Video Generator في الصفحة الرئيسية يفتح الواجهة الحديثة مباشرة.
- إصلاح عرض Trial من `$1.99` إلى `$0` وإظهار Monthly في واجهات التسعير الرئيسية.
- إزالة استدعاءات `/api/abandoned` غير الصحيحة من صفحة ai-image.
- حذف `.env`, `.env.local`, `backend/.env`, وملفات SQLite/Next build/node_modules من حزمة التسليم.
- إضافة `.env.example` بدون أسرار.

## RunPod

**لم يتم تعديل ملفات RunPod المطلوبة حسب طلب صاحب المشروع.**
يشمل ذلك ملفات `runpod-wan22/` وملفات إدارة RunPod والـ RunPod webhook/dispatch.

## التحقق

تم إجراء transpilation نحوي لملفات TypeScript/TSX المعدلة ونجح بدون أخطاء syntax.
اختبار `tsc` الكامل و`prisma generate` لم يكتمل بسبب بيئة dependencies غير المكتملة/timeout أثناء تثبيت الحزم؛ يجب تشغيلها في بيئة التطوير/CI قبل الإنتاج.

## الخطوات التالية

1. تثبيت dependencies بالكامل.
2. تشغيل `prisma generate` ثم `prisma migrate deploy` على نسخة احتياطية من قاعدة PostgreSQL.
3. تشغيل `npm run typecheck` و`npm run build`.
4. اختبار PayPal/Crypto/Manual Payment عملياً في sandbox.
5. اختبار كل تدفقات Credits وrefunds.
6. ثم معالجة بقية عناصر التنظيف والاختبارات، مع إبقاء ملفات RunPod بدون تعديل.

## Phase 2
- Unifies the legacy screenshot/manual-payment endpoint with the hardened manual-payment validation path.
- Prevents duplicate pending manual payment requests for the same user/plan.
- Converts `app/api/admin/plans` into a real Next.js `route.ts` endpoint (the previous filename could not be exposed as `/api/admin/plans`).
- Makes billing price/credit fields read-only in the admin plan editor and rejects server-side edits to those fields, preventing a second billing catalog from diverging from `lib/config.ts`.
- Cleans stale billing comments.
- Removes stale `tsconfig.tsbuildinfo` build metadata.
- RunPod files remain byte-for-byte unchanged.
