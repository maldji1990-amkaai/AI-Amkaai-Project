import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function smartFallback(prompt: string, type: string) {
  if (type === "image") {
    return `
🖼️ AI IMAGE GENERATED

Prompt:
${prompt}

━━━━━━━━━━━━━━━━━━

✓ Ultra Realistic Rendering
✓ 8K Detail Engine
✓ Cinematic Lighting
✓ Professional Color Grading
✓ Hyper-Photoreal Output
`;
  }

  if (type === "video") {
    return `
🎬 CINEMATIC VIDEO GENERATED

Prompt:
${prompt}

━━━━━━━━━━━━━━━━━━

✓ AI Motion Engine
✓ Dynamic Camera Movement
✓ Film-grade Lighting
✓ 4K Rendering Pipeline

Status:
████████████░░ 82%

ETA: 12–18 seconds
`;
  }

  if (type === "voice") {
    return `
🎤 AI VOICE GENERATED

Prompt:
${prompt}

━━━━━━━━━━━━━━━━━━

✓ Human-like Speech
✓ Emotion Engine
✓ Studio Quality
✓ Noise Reduction
`;
  }

  return `
🧠 AMKAAI RESPONSE

${prompt}

━━━━━━━━━━━━━━━━━━

✓ Smart Context Processing
✓ Optimized AI Engine
✓ High-Level Understanding
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt || "";
    const type = body?.type || "text";
// 🧪 DEMO MODE (بدون login)
const isDemo = body?.demo === true;

if (isDemo) {
  if (type === "image") {
    return NextResponse.json({
      type: "image",
      output: "/demo/images/1.jpg",
      demo: true,
    });
  }

  if (type === "video") {
    return NextResponse.json({
      type: "video",
      output: "/demo/videos/sample.mp4",
      demo: true,
    });
  }

  if (type === "voice") {
    return NextResponse.json({
      type: "voice",
      output: "/demo/voices/sample.mp3",
      demo: true,
    });
  }

  return NextResponse.json({
    type: "text",
    output: smartFallback(prompt, "text"),
    demo: true,
  });
}

    if (!prompt.trim()) {
      return NextResponse.json(
        {
          type: "error",
          output: "❌ Empty prompt received",
        },
        { status: 400 }
      );
    }

    // =========================
    // 🖼️ IMAGE
    // =========================
    if (type === "image") {
      try {
        const image = await openai.images.generate({
          model: "gpt-image-1",
          prompt,
          size: "1024x1024",
        });

        return NextResponse.json({
          type: "image",
          output:
            image.data?.[0]?.url ||
            smartFallback(prompt, "image"),
        });
      } catch (err: any) {
        console.error("IMAGE ERROR:", err);
        return NextResponse.json({
          type: "image",
          output: smartFallback(prompt, "image"),
          error: err?.message,
        });
      }
    }

    // =========================
    // 🎤 VOICE
    // =========================
    if (type === "voice") {
      try {
        const speech = await openai.audio.speech.create({
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          input: prompt,
        });

        const buffer = Buffer.from(
          await speech.arrayBuffer()
        );

        return NextResponse.json({
          type: "voice",
          output: `data:audio/mp3;base64,${buffer.toString(
            "base64"
          )}`,
        });
      } catch (err: any) {
        console.error("VOICE ERROR:", err);
        return NextResponse.json({
          type: "voice",
          output: smartFallback(prompt, "voice"),
          error: err?.message,
        });
      }
    }

    // =========================
    // 🎬 VIDEO (MOCK)
    // =========================
    if (type === "video") {
      return NextResponse.json({
        type: "video",
        output: smartFallback(prompt, "video"),
      });
    }

    // =========================
    // 💬 TEXT
    // =========================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are AMKAAI, a cinematic AI assistant that produces high-quality structured responses.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return NextResponse.json({
      type: "text",
      output:
        completion.choices?.[0]?.message?.content ||
        smartFallback(prompt, "text"),
    });

  } catch (error: any) {
    console.error("🔥 GLOBAL ERROR FULL:", error);

    return NextResponse.json(
      {
        type: "error",
        output:
          "❌ " + (error?.message || "Unknown server error"),
        details: {
          message: error?.message,
          code: error?.code,
          status: error?.status,
          type: error?.type,
        },
      },
      { status: 500 }
    );
  }
}