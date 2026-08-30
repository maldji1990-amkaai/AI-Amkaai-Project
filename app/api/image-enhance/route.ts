import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { useCredits, markUsageSuccess, refundCredits } from "@/lib/credits";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { image } = await req.json();
    if (typeof image !== "string" || image.length < 20) return NextResponse.json({ error: "No image" }, { status: 400 });
    if (image.length > 12_000_000) return NextResponse.json({ error: "Image payload too large" }, { status: 413 });
    const user = await getOrCreateUser(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const reference = `enh_${crypto.randomUUID()}`;
    const credit = await useCredits(user.id, "image", { reference });
    try {
      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: "gpt-image-1", image, prompt: "Enhance this image, make it high quality, sharp, detailed" }),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.data?.[0]?.url) throw new Error("OpenAI image edit failed");
      await markUsageSuccess(reference);
      return NextResponse.json({ image: data.data[0].url, remainingCredits: credit.remainingCredits });
    } catch (error) {
      await refundCredits(reference).catch(() => undefined);
      console.error("IMAGE ENHANCE ERROR", error);
      return NextResponse.json({ error: "Enhance failed. Credits refunded." }, { status: 502 });
    }
  } catch (error: any) {
    if (error?.message === "NOT_ENOUGH_CREDITS") return NextResponse.json({ error: "Not enough credits" }, { status: 402 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
