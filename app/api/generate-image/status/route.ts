import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { refundCredits, markUsageSuccess } from "@/lib/credits";
import { requireOutputUrl } from "@/lib/ai-output";
import Replicate from "replicate";

export const dynamic = "force-dynamic";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const generationId = new URL(req.url).searchParams.get("generationId");
    if (!generationId) return NextResponse.json({ error: "generationId is required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const generation = await db.generation.findUnique({ where: { id: generationId } });
    if (!generation) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    if (generation.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const metadata = (generation.metadata as Record<string, any> | null) ?? {};
    const referenceId = typeof metadata.referenceId === "string" ? metadata.referenceId : null;
    const predictionId = typeof metadata.predictionId === "string" ? metadata.predictionId : null;

    // النتيجة النهائية محفوظة مسبقاً — لا حاجة لاستدعاء Replicate مجدداً.
    if (generation.status === "COMPLETED") {
      return NextResponse.json({ status: "done", videoUrl: metadata.outputUrl || null });
    }
    if (generation.status === "FAILED") {
      return NextResponse.json({ status: "failed", error: generation.error || "Generation failed" });
    }

    if (!predictionId) {
      return NextResponse.json({ status: "failed", error: "Missing provider job reference" });
    }

    const result = await replicate.predictions.get(predictionId);

    if (result.status === "succeeded") {
      let outputUrl: string;
      try {
        outputUrl = requireOutputUrl(result.output, "Generated video");
      } catch (e: any) {
        await db.generation.update({
          where: { id: generation.id },
          data: { status: "FAILED", error: e.message || "Invalid provider output" },
        });
        if (referenceId) await refundCredits(referenceId);
        return NextResponse.json({ status: "failed", error: e.message || "Invalid provider output" });
      }

      await db.generation.update({
        where: { id: generation.id },
        data: { status: "COMPLETED", metadata: { ...metadata, outputUrl } },
      });
      if (referenceId) await markUsageSuccess(referenceId);

      return NextResponse.json({ status: "done", videoUrl: outputUrl });
    }

    if (result.status === "failed" || result.status === "canceled") {
      const errorMessage = typeof result.error === "string" ? result.error : "LUMA_RENDER_NODE_FAILED";
      await db.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", error: errorMessage },
      });
      if (referenceId) await refundCredits(referenceId);
      return NextResponse.json({ status: "failed", error: errorMessage });
    }

    // still starting / processing
    return NextResponse.json({ status: "processing" });
  } catch (error) {
    console.error("IMAGE-TO-VIDEO STATUS ROUTE ERROR", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
