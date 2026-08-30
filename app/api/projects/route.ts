import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireStudioUser();
    const projects = await db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, include: { scenes: { orderBy: { index: "asc" } }, assets: { orderBy: { createdAt: "desc" }, take: 24 } } });
    return NextResponse.json({ projects });
  } catch (e) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}

export async function POST(req: Request) {
  try {
    const user = await requireStudioUser();
    const body = await req.json().catch(() => ({}));
    const project = await db.project.create({ data: { userId: user.id, name: String(body.name || "Untitled Production").slice(0, 120), description: body.description ? String(body.description).slice(0, 500) : null, aspectRatio: body.aspectRatio || "16:9" } });
    return NextResponse.json({ project });
  } catch (e) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
