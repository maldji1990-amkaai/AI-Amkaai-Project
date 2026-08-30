import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.NOWPAYMENTS_API_KEY) return NextResponse.json({ error: "Crypto payments unavailable" }, { status: 503 });

  let body: any = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const plan = String(body?.plan || "monthly").toLowerCase();
  const plans: Record<string, { price: number; description: string }> = {
    monthly: { price: 17.99, description: "MONTHLY PLAN" },
    quarterly: { price: 44.97, description: "QUARTERLY PLAN" },
    biannually: { price: 77.94, description: "BIANNUALLY PLAN" },
    business: { price: 0, description: "BUSINESS PLAN" },
  };
  const selected = plans[plan];
  if (!selected || selected.price <= 0) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.amkaai.net";
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: selected.price,
      price_currency: "usd",
      pay_currency: "usdttrc20",
      order_id: userId,
      order_description: selected.description,
      success_url: `${baseUrl}/dashboard`,
      cancel_url: `${baseUrl}/pricing`,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data?.invoice_url) return NextResponse.json({ error: "Unable to create crypto invoice" }, { status: 502 });
  return NextResponse.json({ url: data.invoice_url });
}
