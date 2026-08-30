import { NextResponse } from "next/server";

/** Legacy self-upgrade endpoint intentionally disabled. Subscription changes must come from a verified payment webhook. */
export async function POST() {
  return NextResponse.json({ error: "Plan changes must be completed through checkout." }, { status: 410 });
}
