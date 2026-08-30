import { NextResponse } from "next/server";
import { requireStudioUser } from "@/app/api/_studio-auth";
import { db } from "@/lib/db";
import { startFinalComposition } from "@/lib/final-composer";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStudioUser();
    const { id } = await params;
    const generation = await db.generation.findFirst({ where: { id, userId: user.id }, select: { id: true, projectId: true } });
    if (!generation) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    const result = await startFinalComposition(id);
    return NextResponse.json({ generationId: id, ...result });
  } catch (e) {
    const message = String((e as Error)?.message || "Final composition failed");
    if (message === "SCENES_NOT_READY") return NextResponse.json({ error: "All scene videos must be completed first." }, { status: 409 });
    if (message.startsWith("COMPOSER_DISPATCH_FAILED") || message === "COMPOSER_NO_JOB_ID") return NextResponse.json({ error: message }, { status: 502 });
    return NextResponse.json({ error: "Unauthorized or invalid generation" }, { status: 401 });
  }
}
