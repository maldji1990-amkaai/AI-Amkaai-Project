import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser?.id) return NextResponse.json({ plan: "TRIAL", credits: 0 }, { status: 401 });
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
    const user = await getOrCreateUser(clerkUser.id, email);
    return NextResponse.json({ plan: user?.plan ?? "TRIAL", credits: user?.credits ?? 0 });
  } catch (error: any) {
    console.error("CREDITS_ROUTE_ERROR", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return NextResponse.json({ error: "Failed to load credits", detail: String(error?.message || error) }, { status: 500 });
  }
}
