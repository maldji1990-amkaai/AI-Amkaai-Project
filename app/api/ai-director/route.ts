import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";
import { buildContinuityPrompt, type ContinuityBible } from "@/lib/ai-director-continuity";

export const maxDuration = 60;

const DEFAULT_BIBLE: ContinuityBible = {
  visualStyle: "cinematic, polished commercial quality",
  location: "consistent environment and geography across scenes",
  lighting: "consistent direction, color temperature and time of day",
  cameraLanguage: "controlled cinematic camera movement, coherent lens language",
  characterBible: "keep the same face, age, proportions and identity across scenes",
  wardrobe: "keep wardrobe and accessories consistent unless a change is explicitly requested",
  colorPalette: "coherent palette across the complete film",
  negativePrompt: "identity drift, wardrobe changes, inconsistent environment, extra limbs, distorted hands, random text, watermarks",
};

function makeFallback(prompt: string, count: number, bible: ContinuityBible) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Scene ${i + 1}`,
    prompt: buildContinuityPrompt(bible, `${prompt}. Shot ${i + 1}: clear subject action, cinematic composition and a natural transition from the previous shot.`),
    duration: 5,
  }));
}

export async function POST(req: Request) {
  try {
    const u = await requireStudioUser();
    const body = await req.json();
    const prompt = String(body.prompt || "").trim();
    const requestedDuration = Math.max(5, Math.min(120, Number(body.durationSeconds) || 30));
    const count = Math.ceil(requestedDuration / 5);
    const characterId = body.characterId ? String(body.characterId) : null;
    const voiceProfileId = body.voiceProfileId ? String(body.voiceProfileId) : null;

    if (prompt.length < 10) return NextResponse.json({ error: "Prompt too short" }, { status: 400 });

    let character: any = null;
    if (characterId) {
      character = await db.character.findFirst({ where: { id: characterId, userId: u.id } });
      if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    let voiceProfile: any = null;
    if (voiceProfileId) {
      voiceProfile = await db.voiceProfile.findFirst({ where: { id: voiceProfileId, userId: u.id } });
      if (!voiceProfile) return NextResponse.json({ error: "Voice profile not found" }, { status: 404 });
    }

    const bible: ContinuityBible = {
      ...DEFAULT_BIBLE,
      characterBible: character
        ? `${character.name}. ${character.description || "Preserve the saved identity."} Style: ${character.style || "consistent cinematic realism"}. Reference: ${character.referenceId || "use the saved character reference when supported"}.`
        : DEFAULT_BIBLE.characterBible,
    };

    let title = "Untitled Production";
    let description = "AI Director production";
    let scenes: Array<{ title: string; prompt: string; duration: number }> = [];

    if (process.env.OPENAI_API_KEY) {
      try {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const r = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          temperature: 0.65,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are a senior commercial film director. Return JSON only: {"title":string,"description":string,"continuity":${JSON.stringify(DEFAULT_BIBLE)},"scenes":[{"title":string,"prompt":string}]}. Create exactly ${count} scenes. Every scene is exactly 5 seconds. Build a coherent beginning, middle and ending. Scene prompts must include subject action, camera, lighting, environment and transition intent. Never invent a new main character if a character bible is supplied. Keep identity, wardrobe, location, lighting and visual language locked across all scenes.`,
            },
            { role: "user", content: `${prompt}\n\nTarget duration: ${requestedDuration}s.\n\nContinuity bible:\n${JSON.stringify(bible)}` },
          ],
        });
        const parsed = JSON.parse(r.choices[0]?.message?.content || "{}");
        title = String(parsed.title || title);
        description = String(parsed.description || description);
        const generated = Array.isArray(parsed.scenes) ? parsed.scenes : [];
        scenes = generated.slice(0, count).map((s: any, i: number) => ({
          title: String(s.title || `Scene ${i + 1}`).slice(0, 120),
          prompt: buildContinuityPrompt(bible, String(s.prompt || prompt).slice(0, 7000)),
          duration: 5,
        }));
        if (scenes.length !== count) throw new Error("DIRECTOR_SCENE_COUNT_MISMATCH");
      } catch {
        scenes = makeFallback(prompt, count, bible);
      }
    } else {
      scenes = makeFallback(prompt, count, bible);
    }

    const project = await db.project.create({
      data: {
        userId: u.id,
        name: title.slice(0, 120),
        description: description.slice(0, 500),
        metadata: {
          directorPrompt: prompt,
          requestedDuration,
          sceneCount: count,
          clipSeconds: 5,
          creditsPerSecond: 5,
          continuityBible: bible,
          voiceProfileId: voiceProfileId || null,
          characterId: characterId || null,
        },
      },
    });

    await db.scene.createMany({
      data: scenes.map((s, i) => ({
        projectId: project.id,
        index: i,
        title: s.title,
        prompt: s.prompt,
        duration: 5,
        metadata: { continuityLocked: true, continuityBible: bible, sceneNumber: i + 1 },
      })),
    });

    return NextResponse.json({
      projectId: project.id,
      title,
      durationSeconds: requestedDuration,
      sceneCount: count,
      credits: requestedDuration * 5,
      clipSeconds: 5,
      continuity: bible,
      characterId,
      voiceProfileId,
      scenes,
    });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("AI Director failed", e);
    return NextResponse.json({ error: "AI Director failed" }, { status: 500 });
  }
}
