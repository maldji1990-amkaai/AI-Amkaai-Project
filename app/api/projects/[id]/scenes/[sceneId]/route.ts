import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string,sceneId:string}>}){try{const user=await requireStudioUser();const {id,sceneId}=await params;const scene=await db.scene.findFirst({where:{id:sceneId,projectId:id,project:{userId:user.id}}});if(!scene)return NextResponse.json({error:"Not found"},{status:404});const b=await req.json();const data:any={};if(b.title!==undefined)data.title=String(b.title).slice(0,120);if(b.prompt!==undefined)data.prompt=String(b.prompt).slice(0,8000);if(b.duration!==undefined)data.duration=Math.max(1,Math.min(120,Number(b.duration)||5));if(b.status!==undefined&&["PENDING","PROCESSING","COMPLETED","FAILED","CANCELLED"].includes(b.status))data.status=b.status;
if(b.characterId!==undefined){
  const value=b.characterId?String(b.characterId):null;
  if(value){const c=await db.character.findFirst({where:{id:value,userId:user.id},select:{id:true}});if(!c)return NextResponse.json({error:"Character not found"},{status:404});}
  data.characterId=value;
}
if(b.voiceProfileId!==undefined){
  const value=b.voiceProfileId?String(b.voiceProfileId):null;
  if(value){const v=await db.voiceProfile.findFirst({where:{id:value,userId:user.id},select:{id:true}});if(!v)return NextResponse.json({error:"Voice profile not found"},{status:404});}
  data.voiceProfileId=value;
}const updated=await db.scene.update({where:{id:sceneId},data});return NextResponse.json({scene:updated});}catch{return NextResponse.json({error:"Unauthorized"},{status:401});}}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string,sceneId:string}>}){try{const user=await requireStudioUser();const {id,sceneId}=await params;const scene=await db.scene.findFirst({where:{id:sceneId,projectId:id,project:{userId:user.id}}});if(!scene)return NextResponse.json({error:"Not found"},{status:404});await db.scene.delete({where:{id:sceneId}});return NextResponse.json({success:true});}catch{return NextResponse.json({error:"Unauthorized"},{status:401});}}
