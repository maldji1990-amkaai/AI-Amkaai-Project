import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma || new PrismaClient();
export const prismadb = db; // إضافة هذا السطر سيحل مشاكل الاستيراد في كل الملفات القديمة

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;