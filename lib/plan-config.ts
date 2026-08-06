// lib/plan-config.ts
//
// 🧠 المصدر الوحيد للحقيقة لإعدادات الباقات (نقاط، جودة، موديل AI، علامة مائية، أولوية).
// تُقرأ من جدول PlanConfig في قاعدة البيانات بدل القيم الثابتة في lib/config.ts،
// بحيث تتحكم بها لوحة الإدارة (app/admin/plans) بدون أي تعديل كود أو نشر جديد.
//
// نستخدم cache بسيط بالذاكرة (60 ثانية) لتفادي ضرب قاعدة البيانات في كل طلب توليد فيديو،
// مع إمكانية مسح الـ cache فوراً بعد أي تعديل من لوحة الإدارة عبر invalidatePlanConfigCache().

import { db } from "@/lib/db";

export type PlanConfigData = {
  id: string;
  planKey: string;
  name: string;
  credits: number;
  price: number;
  isPro: boolean;
  resolution: string;
  maxDurationSeconds: number;
  aiModel: string;
  advancedSampling: boolean;
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  watermarkText: string;
  priority: number;
};

const CACHE_TTL_MS = 60 * 1000; // 60 ثانية

let cache: Map<string, PlanConfigData> | null = null;
let cacheTimestamp = 0;

async function loadAllFromDb(): Promise<Map<string, PlanConfigData>> {
  const rows = await db.planConfig.findMany();
  const map = new Map<string, PlanConfigData>();
  for (const row of rows) {
    map.set(row.planKey, row);
  }
  return map;
}

async function getCache(): Promise<Map<string, PlanConfigData>> {
  const now = Date.now();
  if (!cache || now - cacheTimestamp > CACHE_TTL_MS) {
    cache = await loadAllFromDb();
    cacheTimestamp = now;
  }
  return cache;
}

/**
 * جلب إعدادات باقة واحدة حسب مفتاحها (trial/monthly/quarterly/biannually/business)
 * تُرجع null إذا لم تكن الباقة موجودة في قاعدة البيانات بعد (مثلاً قبل تشغيل seed script)
 */
export async function getPlanConfig(planKey: string): Promise<PlanConfigData | null> {
  const normalizedKey = planKey.toLowerCase();
  const map = await getCache();
  return map.get(normalizedKey) ?? null;
}

/**
 * جلب كل الباقات (تُستخدم في صفحة pricing وفي لوحة الإدارة)
 */
export async function getAllPlanConfigs(): Promise<PlanConfigData[]> {
  const map = await getCache();
  return Array.from(map.values());
}

/**
 * 🔄 إلغاء الـ cache فوراً — يجب استدعاؤها بعد كل تعديل ناجح من لوحة الإدارة
 * حتى تنعكس التغييرات فوراً بدون انتظار 60 ثانية
 */
export function invalidatePlanConfigCache() {
  cache = null;
  cacheTimestamp = 0;
}
