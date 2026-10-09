import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundCredits, markUsageSuccess } from "@/lib/credits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const generationId = url.searchParams.get("generationId");

    if (
      !process.env.RUNPOD_WEBHOOK_SECRET ||
      secret !== process.env.RUNPOD_WEBHOOK_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!generationId) {
      return NextResponse.json(
        { error: "Missing generationId" },
        { status: 400 },
      );
    }

    const body = await req.json();

    // The worker must report the application generation ID we submitted.
    if (body?.id !== generationId) {
      return NextResponse.json(
        { error: "Generation ID mismatch" },
        { status: 409 },
      );
    }

    const generation = await db.generation.findUnique({
      where: { id: generationId },
    });

    if (!generation) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 },
      );
    }

    const metadata =
      generation.metadata &&
      typeof generation.metadata === "object" &&
      !Array.isArray(generation.metadata)
        ? (generation.metadata as Record<string, unknown>)
        : {};

    if (metadata.provider !== "RUNPOD_WAN22") {
      return NextResponse.json(
        { error: "Unexpected generation provider" },
        { status: 409 },
      );
    }

    // Ignore late or duplicate callbacks for an already-final generation.
    if (["COMPLETED", "FAILED"].includes(generation.status)) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const status = String(body?.status || "").toUpperCase();

    // Progress updates are acknowledged; the status endpoint reports processing.
    if (status === "PROCESSING") {
      return NextResponse.json({ success: true, status: "PROCESSING" });
    }

    const referenceId =
      typeof metadata.referenceId === "string"
        ? metadata.referenceId
        : null;

    if (status === "COMPLETED") {
      const videoUrl = body?.output?.video_url;

      if (
        typeof videoUrl !== "string" ||
        !/^https?:\/\//i.test(videoUrl)
      ) {
        const errorMessage = "RunPod callback did not include a valid video_url";

        const updated = await db.generation.updateMany({
          where: { id: generationId, status: "PROCESSING" },
          data: { status: "FAILED", error: errorMessage },
        });

        if (updated.count > 0 && referenceId) {
          await refundCredits(referenceId);
        }

        return NextResponse.json({
          success: true,
          status: "FAILED",
          error: errorMessage,
        });
      }

      const updated = await db.generation.updateMany({
        where: { id: generationId, status: "PROCESSING" },
        data: {
          status: "COMPLETED",
          error: null,
          metadata: {
            ...metadata,
            outputUrl: videoUrl,
            providerJobId:
              typeof body?.id === "string" ? body.id : generationId,
            completedAt: new Date().toISOString(),
          },
        },
      });

      if (updated.count > 0 && referenceId) {
        await markUsageSuccess(referenceId);
      }

      return NextResponse.json({
        success: true,
        status: updated.count > 0 ? "COMPLETED" : "UNCHANGED",
      });
    }

    if (
      status === "FAILED" ||
      status === "CANCELLED" ||
      body?.error ||
      body?.output?.error
    ) {
      const errorMessage = String(
        body?.error ||
          body?.output?.error ||
          `RunPod generation ${status || "failed"}`,
      );

      const updated = await db.generation.updateMany({
        where: { id: generationId, status: "PROCESSING" },
        data: {
          status: "FAILED",
          error: errorMessage,
        },
      });

      // Only refund when this callback actually changed the active generation.
      if (updated.count > 0 && referenceId) {
        await refundCredits(referenceId);
      }

      return NextResponse.json({
        success: true,
        status: updated.count > 0 ? "FAILED" : "UNCHANGED",
      });
    }

    return NextResponse.json({
      success: true,
      ignored: true,
      receivedStatus: status || "UNKNOWN",
    });
  } catch (error) {
    console.error("IMAGE-TO-VIDEO WEBHOOK ERROR:", error);

    return NextResponse.json(
      { error: "Internal webhook error" },
      { status: 500 },
    );
  }
}