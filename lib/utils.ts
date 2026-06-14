// lib/utils.ts

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 🎨 دمج التنسيقات الذكي لـ Tailwind CSS
 * تمنع تضارب الفئات (Class Conflicts) وتسمح بتركيب التنسيقات الشرطية بسلاسة
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 🔢 تنسيق الأرقام الكبيرة والترصيد المالي
 * يحول مثلاً (1200) إلى "1,200" ليعطي مظهر SaaS احترافي داخل لوحة التحكم
 */
export function formatNumber(num: number): string {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat().format(num);
}

/**
 * ⏱️ محاكي منسق فترات المعالجة والانتظار (Duration Formatter)
 * يحول الثواني إلى صيغة رقمية للمشغل (مثل: 95 ثانية تصبح "1:35")
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 🆔 توليد معرّفات مرجعية فريدة آمنة للعمليات (Reference Generators)
 * تُستخدم لإنشاء الـ referenceId لعمليات الـ API وربطها بنظام الـ Refund التلقائي
 */
export function generateReferenceId(prefix: "vid" | "img" | "voc" | "avt"): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${randomStr}`;
}

/**
 * 📅 منسق التواريخ والسجلات (Date Formatter)
 * يحول تواريخ إنشاء الفيديوهات أو تاريخ انتهاء الاشتراك إلى صيغة مقروءة ومريحة للمستخدم
 */
export function formatDate(date: Date | string | number): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}