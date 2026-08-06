// prisma/seed-plan-config.ts
//
// 🌱 تشغيل مرة واحدة فقط لتعبئة جدول PlanConfig بالقيم الأولية.
// بعدها، كل تعديل يتم من لوحة الإدارة مباشرة (app/admin/plans) وليس من هذا الملف.
//
// طريقة التشغيل:
//   npx tsx prisma/seed-plan-config.ts
// أو إذا لم يكن tsx مثبتاً:
//   npx ts-node prisma/seed-plan-config.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const INITIAL_PLANS = [
  {
    planKey: "trial",
    name: "3-Day Trial",
    credits: 30,
    price: 0,
    isPro: false,
    resolution: "720p",
    maxDurationSeconds: 5,
    aiModel: "wan-video/wan-2.5-t2v-fast",
    advancedSampling: false,
    watermarkEnabled: true,
    watermarkOpacity: 40,
    watermarkText: "AMKAAI.NET",
    priority: 0,
  },
  {
    planKey: "monthly",
    name: "Monthly",
    credits: 100, // ⚠️ قيمة مؤقتة - عدّلها من لوحة الإدارة لاحقاً
    price: 17.99,
    isPro: true,
    resolution: "720p",
    maxDurationSeconds: 8,
    aiModel: "wan-video/wan-2.5-t2v-fast",
    advancedSampling: false,
    watermarkEnabled: false,
    watermarkOpacity: 0,
    watermarkText: "AMKAAI.NET",
    priority: 1,
  },
  {
    planKey: "quarterly",
    name: "Quarterly Saver",
    credits: 300,
    price: 44.97,
    isPro: true,
    resolution: "1080p",
    maxDurationSeconds: 8,
    aiModel: "wan-video/wan-2.5-t2v-14b",
    advancedSampling: true,
    watermarkEnabled: false,
    watermarkOpacity: 0,
    watermarkText: "AMKAAI.NET",
    priority: 2,
  },
  {
    planKey: "biannually",
    name: "6 Months Cinematic",
    credits: 900,
    price: 77.94,
    isPro: true,
    resolution: "1080p",
    maxDurationSeconds: 10,
    aiModel: "wan-video/wan-2.5-t2v-14b",
    advancedSampling: true,
    watermarkEnabled: false,
    watermarkOpacity: 0,
    watermarkText: "AMKAAI.NET",
    priority: 3,
  },
  {
    planKey: "business",
    name: "Business",
    credits: 2000, // ⚠️ قيمة مؤقتة - عدّلها من لوحة الإدارة لاحقاً
    price: 0, // ⚠️ السعر لم يُحدَّد بعد
    isPro: true,
    resolution: "1080p",
    maxDurationSeconds: 120, // حتى دقيقتين
    aiModel: "wan-video/wan-2.5-t2v-14b",
    advancedSampling: true,
    watermarkEnabled: false,
    watermarkOpacity: 0,
    watermarkText: "AMKAAI.NET",
    priority: 10, // أعلى أولوية في الطابور
  },
];

async function main() {
  console.log("🌱 Seeding PlanConfig table...");

  for (const plan of INITIAL_PLANS) {
    const result = await db.planConfig.upsert({
      where: { planKey: plan.planKey },
      update: {}, // لا نلمس الصفوف الموجودة مسبقاً حتى لا نكتب فوق تعديلات الأدمن اليدوية
      create: plan,
    });
    console.log(`✅ ${result.planKey} -> ${result.credits} credits, ${result.resolution}, model: ${result.aiModel}`);
  }

  console.log("🎉 Done seeding PlanConfig.");
}

main()
  .catch((e) => {
    console.error("🔥 Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
