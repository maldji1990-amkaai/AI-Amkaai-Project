import { NextResponse } from "next/server";
import { demoAvatars } from "@/lib/demo";

export async function POST() {
  const avatar =
    demoAvatars[
      Math.floor(Math.random() * demoAvatars.length)
    ];

  return NextResponse.json({
    avatar,
    demo: true,
  });
}