import { NextResponse } from "next/server";
import { reconcileVideoGpu } from "@/lib/runpod-pod-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await reconcileVideoGpu();
    return NextResponse.json({
      ok: true,
      service: "vercel-video-gpu-safety-cron",
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("VIDEO GPU SAFETY CRON ERROR", error);
    return NextResponse.json(
      { ok: false, service: "vercel-video-gpu-safety-cron", error: String(error) },
      { status: 500 },
    );
  }
}
