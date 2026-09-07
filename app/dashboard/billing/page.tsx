import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BillingHistoryPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in?redirect_url=/dashboard/billing");
  const user = await db.user.findUnique({ where: { clerkId }, select: { id: true, email: true } });
  if (!user) redirect("/dashboard");

  const [payments, manual] = await Promise.all([
    db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.manualPayment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const rows = [
    ...payments.map((p) => ({ id: p.id, date: p.createdAt, source: p.provider, plan: p.plan ?? "—", amount: p.amount, currency: p.currency, status: p.status })),
    ...manual.map((p) => ({ id: p.id, date: p.createdAt, source: `manual/${p.method}`, plan: p.plan, amount: p.amount, currency: p.currency, status: p.status })),
  ].sort((a,b) => b.date.getTime() - a.date.getTime());

  return (
    <main className="min-h-screen bg-[#030305] text-white p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-black">Billing History</h1>
        <p className="mt-2 text-sm text-gray-500">{user.email ?? ""}</p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-gray-400"><tr><th className="p-4">Date</th><th className="p-4">Source</th><th className="p-4">Plan</th><th className="p-4">Amount</th><th className="p-4">Status</th></tr></thead>
            <tbody>{rows.length ? rows.map(r => <tr key={r.id} className="border-t border-white/5"><td className="p-4">{r.date.toLocaleString()}</td><td className="p-4">{r.source}</td><td className="p-4">{r.plan}</td><td className="p-4">{r.amount} {r.currency}</td><td className="p-4">{r.status}</td></tr>) : <tr><td colSpan={5} className="p-8 text-center text-gray-500">No billing transactions yet.</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
