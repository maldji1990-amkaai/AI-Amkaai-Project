import { NextResponse } from "next/server";

export async function GET() {
  const rip = process.env.BARIDIMOB_RIP;
  const usdt = process.env.USDT_TRC20_ADDRESS;
  const toPositiveNumber = (value: string | undefined) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const dzd = {
    monthly: toPositiveNumber(process.env.MANUAL_PRICE_DZD_MONTHLY),
    quarterly: toPositiveNumber(process.env.MANUAL_PRICE_DZD_QUARTERLY),
    biannually: toPositiveNumber(process.env.MANUAL_PRICE_DZD_BIANNUALLY),
  };

  return NextResponse.json(
    {
      rip: rip ?? "",
      usdt: usdt ?? "",
      dzd,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}