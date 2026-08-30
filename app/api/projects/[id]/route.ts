import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user=await requireStudioUser(); const {id}=await params; const project=await db.project.findFirst({where:{id,userId:user.id},include:{scenes:{orderBy:{index:"asc"}},assets:{orderBy:{createdAt:"desc"}}}}); if(!project)return NextResponse.json({error:"Not found"},{status:404}); return NextResponse.json({project}); } catch { return NextResponse.json({error:"Unauthorized"},{status:401}); }
}
