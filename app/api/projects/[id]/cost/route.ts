import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";
import { getVideoCreditCost, getVideoClipCount } from "@/lib/video-cost";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStudioUser();
    const { id } = await params;
    const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { scenes: { orderBy: { index: "asc" } } } });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const scenes = project.scenes.map(s => ({ id: s.id, title: s.title, durationSeconds: s.duration, clips: getVideoClipCount(s.duration), credits: getVideoCreditCost(s.duration) }));
    const totalSeconds = scenes.reduce((n, s) => n + s.durationSeconds, 0);
    const totalCredits = scenes.reduce((n, s) => n + s.credits, 0);
    return NextResponse.json({ totalSeconds, totalCredits, scenes });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
