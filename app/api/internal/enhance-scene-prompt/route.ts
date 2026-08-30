import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { LIMITS } from "@/lib/config";

export const dynamic = "force-dynamic";

// 🧠 نموذج Claude Haiku 4.5 - الأرخص والأسرع من عائلة Claude، مثالي لمهمة تحويل نص قصير
// إلى prompt سينمائي مفصّل (تكلفة الاستدعاء الواحد أقل من 0.001$ تقريباً)
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a professional cinematic prompt engineer for AI video generation models (like Wan 2.5).
Given a short, simple description from a user, expand it into a detailed, vivid, cinematic video generation prompt.

Rules:
- Include: camera angle/movement, lighting, mood/atmosphere, visual style, and specific action details.
- Keep it under 200 words.
- Write in English regardless of the input language (video models perform best with English prompts).
- Do NOT include any explanation, preamble, or quotation marks — output ONLY the final prompt text.
- Do NOT invent unrelated elements the user didn't imply — stay faithful to their original idea, just make it richer and more specific.`;

export async function POST(req: Request) {
  try {
    // 🔒 التحقق من هوية المستخدم
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const userInput = body?.text?.trim();

    if (!userInput || userInput.length < 2) {
      return NextResponse.json({ error: "Please enter a short description first." }, { status: 400 });
    }

    if (userInput.length > LIMITS.maxPromptLength) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${LIMITS.maxPromptLength} characters.` },
        { status: 400 }
      );
    }

    // 🤖 استدعاء Anthropic API مباشرة
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userInput }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("🔥 Anthropic API error:", errText);
      return NextResponse.json({ error: "Failed to enhance prompt. Please try again." }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const enhancedPrompt: string | undefined = data?.content?.[0]?.text?.trim();

    if (!enhancedPrompt) {
      return NextResponse.json({ error: "Empty response from AI. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      originalText: userInput,
      enhancedPrompt,
    });

  } catch (error: any) {
    console.error("🔥 ENHANCE PROMPT ERROR:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
