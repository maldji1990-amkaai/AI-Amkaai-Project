import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";
export async function POST(req: Request,{params}:{params:Promise<{id:string}>}){
 try{const user=await requireStudioUser();const {id}=await params;const project=await db.project.findFirst({where:{id,userId:user.id}});if(!project)return NextResponse.json({error:"Not found"},{status:404});const b=await req.json().catch(()=>({}));const last=await db.scene.aggregate({where:{projectId:id},_max:{index:true}});const scene=await db.scene.create({data:{projectId:id,index:(last._max.index??-1)+1,title:String(b.title||`Scene ${(last._max.index??-1)+2}`).slice(0,120),prompt:String(b.prompt||"Describe the shot...").slice(0,4000),duration:Math.max(1,Math.min(120,Number(b.duration)||5)),
 ...(b.characterId ? { characterId: String(b.characterId) } : {}),
...(b.voiceProfileId ? { voiceProfileId: String(b.voiceProfileId) } : {}),
 }});return NextResponse.json({scene});}catch{return NextResponse.json({error:"Unauthorized"},{status:401});}
}
