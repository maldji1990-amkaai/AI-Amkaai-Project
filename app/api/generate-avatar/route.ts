import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { demoAvatars } from "@/lib/demo";
import { PlanType } from "@prisma/client";

export async function POST() {
  // 🔐 AUTH
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 👤 GET OR CREATE USER
  let user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        clerkId: userId,
        credits: 10,
        plan: PlanType.FREE,
      },
    });
  }

  //////////////////////////////////////////////////
  // 🧠 DEMO MODE (FREE USERS)
  //////////////////////////////////////////////////

  if (user.plan === PlanType.FREE) {
    const avatar =
      demoAvatars[
        Math.floor(Math.random() * demoAvatars.length)
      ];

    return NextResponse.json({
      avatar,
      demo: true,
    });
  }

  //////////////////////////////////////////////////
  // 💎 PRO / PREMIUM (future real AI)
  //////////////////////////////////////////////////

  // هنا لاحقا تربط API حقيقي
  const avatar =
    demoAvatars[
      Math.floor(Math.random() * demoAvatars.length)
    ];

  return NextResponse.json({
    avatar,
    demo: false,
  });
}