import { db } from "@/lib/db";

//////////////////////////////////////////////////
// 🖼 IMAGE WORKER (CLEAN + SAFE + DYNAMIC)
//////////////////////////////////////////////////

export async function processImageJob(jobId: string) {
  try {
    //////////////////////////////////////////////////
    // 🔎 FETCH IMAGE FROM DB
    //////////////////////////////////////////////////
    const job = await db.image.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.log("❌ Image job not found:", jobId);
      return;
    }

    console.log("🧠 Processing image:", job.prompt);

    //////////////////////////////////////////////////
    // ⏳ SIMULATE AI PROCESSING (TEMP)
    //////////////////////////////////////////////////
    await new Promise((resolve) => setTimeout(resolve, 3000));

    //////////////////////////////////////////////////
    // 🎯 GENERATE DYNAMIC RESULT (BASED ON PROMPT)
    //////////////////////////////////////////////////
    const resultUrl = `https://dummyimage.com/800x600/000/fff&text=${encodeURIComponent(
      job.prompt
    )}`;

    //////////////////////////////////////////////////
    // 💾 UPDATE DATABASE
    //////////////////////////////////////////////////
    await db.image.update({
      where: { id: jobId },
      data: {
        url: resultUrl,
      },
    });

    console.log("✅ Image generated:", resultUrl);
  } catch (error) {
    console.error("🔥 IMAGE WORKER ERROR:", error);
  }
}