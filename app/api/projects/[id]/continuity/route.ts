import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireStudioUser();
    const { id } = await ctx.params;
    const project = await db.project.findFirst({ where: { id, userId: u.id }, include: { scenes: { orderBy: { index: "asc" }, include: { character: true, voiceProfile: true } } } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const meta = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
    return NextResponse.json({ continuity: meta.continuityBible || null, scenes: project.scenes.map(s => ({ id: s.id, index: s.index, character: s.character ? { id: s.character.id, name: s.character.name, referenceId: s.character.referenceId } : null, voice: s.voiceProfile ? { id: s.voiceProfile.id, name: s.voiceProfile.name } : null, locked: Boolean((s.metadata as any)?.continuityLocked) })) });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to load continuity" }, { status: 500 });
  }
}
