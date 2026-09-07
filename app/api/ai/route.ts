import { NextResponse } from "next/server";

/**
 * Legacy landing-page demo endpoint.
 *
 * Real paid generation must use the dedicated generation APIs, which enforce
 * Clerk authentication, subscription entitlement and credit reservation.
 * This endpoint intentionally never calls a paid AI provider.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
    const type = typeof body?.type === "string" ? body.type : "text";

    if (body?.demo !== true) {
      return NextResponse.json(
        { error: "This legacy demo endpoint is disabled for real generation. Use the dedicated generation API." },
        { status: 410 },
      );
    }

    if (!prompt) {
      return NextResponse.json({ error: "Empty prompt received" }, { status: 400 });
    }

    if (type === "image") {
      return NextResponse.json({ type: "image", output: "/demo/images/1.jpg", demo: true });
    }
    if (type === "video") {
      return NextResponse.json({ type: "video", output: "/demo/videos/sample.mp4", demo: true });
    }
    if (type === "voice") {
      return NextResponse.json({ type: "voice", output: "/demo/voices/sample.mp3", demo: true });
    }

    return NextResponse.json({
      type: "text",
      output: `AMKAAI demo response\n\n${prompt}`,
      demo: true,
    });
  } catch (error) {
    console.error("LEGACY DEMO API ERROR", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
