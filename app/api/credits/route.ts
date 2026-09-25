import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Credits endpoint is the single source used by the Generate UI.
 * It deliberately reads the same database User that the generation API uses:
 * Clerk user id -> getOrCreateUser() -> User.id -> User.credits.
 *
 * This is important when credits are added manually in Prisma Studio: the
 * credit must belong to the User row linked to the currently authenticated
 * Clerk account.
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { authenticated: false, plan: "TRIAL", credits: 0 },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
    const user = await getOrCreateUser(clerkId, email);

    if (!user) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", authenticated: true },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        userId: user.id,
        clerkId: user.clerkId,
        email: user.email,
        plan: user.plan,
        credits: Math.max(0, Number(user.credits) || 0),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("CREDITS_ROUTE_ERROR", error);
    return NextResponse.json(
      { error: "Failed to load credits" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
