import { PLANS } from "@/lib/config";
import type { ConfigPlanType } from "@/lib/config";

/**
 * Server-side prices for manual/local payment methods.
 * Never trust a client-supplied amount. Configure the local-currency prices
 * in environment variables before enabling that payment method.
 */
const LOCAL_PRICE_ENV: Record<string, Record<Exclude<ConfigPlanType, "trial" | "business">, string>> = {
  DZD: {
    monthly: "MANUAL_PRICE_DZD_MONTHLY",
    quarterly: "MANUAL_PRICE_DZD_QUARTERLY",
    biannually: "MANUAL_PRICE_DZD_BIANNUALLY",
  },
};

export function getManualPaymentAmount(plan: Exclude<ConfigPlanType, "trial" | "business">, currency: string): number {
  const normalizedCurrency = currency.trim().toUpperCase();

  if (normalizedCurrency === "USD" || normalizedCurrency === "USDT") {
    return PLANS[plan].price;
  }

  const envName = LOCAL_PRICE_ENV[normalizedCurrency]?.[plan];
  if (!envName) throw new Error("UNSUPPORTED_MANUAL_CURRENCY");

  const amount = Number(process.env[envName]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`MANUAL_PRICE_NOT_CONFIGURED:${envName}`);
  }
  return amount;
}
