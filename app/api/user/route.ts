import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { getEffectiveEntitlement } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET() {
  const clerkUser = await currentUser();
  if (!clerkUser?.id) return NextResponse.json({ plan: "TRIAL", credits: 0, active: false }, { status: 401 });
  const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
  const user = await getOrCreateUser(clerkUser.id, email);
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  const entitlement = await getEffectiveEntitlement(user.id);
  return NextResponse.json({ plan: user.plan, credits: user.credits, active: entitlement.active, cancelAtPeriodEnd: entitlement.subscription?.cancelAtPeriodEnd ?? false, currentPeriodEnd: entitlement.subscription?.currentPeriodEnd ?? user.trialEndsAt ?? null }, { headers: { "Cache-Control": "no-store" } });
}
