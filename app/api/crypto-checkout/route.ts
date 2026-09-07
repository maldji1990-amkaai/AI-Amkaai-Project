import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { normalizePlan, planPrice } from "@/lib/billing";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.NOWPAYMENTS_API_KEY) return NextResponse.json({ error: "Crypto payments unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const plan = normalizePlan(body?.plan || "monthly");
  if (!plan || plan === "trial" || plan === "business" || planPrice(plan) <= 0) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.amkaai.net").replace(/\/$/, "");
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: planPrice(plan),
      price_currency: "usd",
      pay_currency: "usdttrc20",
      order_id: userId,
      order_description: `${plan.toUpperCase()} PLAN`,
      success_url: `${baseUrl}/dashboard`,
      cancel_url: `${baseUrl}/pricing`,
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.invoice_url) return NextResponse.json({ error: "Unable to create crypto invoice" }, { status: 502 });
  return NextResponse.json({ url: data.invoice_url });
}
