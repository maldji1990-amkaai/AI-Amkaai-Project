import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const [users, videosToday] = await Promise.all([
      db.user.count(),
      db.videoJob.count({ where: { status: "COMPLETED", finishedAt: { gte: since } } }),
    ]);
    return NextResponse.json({ visitors: users, online: 0, videosGenerated: videosToday, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("VISITOR STATS ERROR", error);
    return NextResponse.json({ visitors: 0, online: 0, videosGenerated: 0, updatedAt: new Date().toISOString() }, { status: 503 });
  }
}
