import { NextResponse } from "next/server";

export async function POST() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_UPGRADE !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json({ error: "Dev upgrade is disabled in this build." }, { status: 410 });
}
