"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft, Crown, Calendar, Clock, CreditCard,
  CheckCircle2, AlertCircle, Zap, Loader2, ExternalLink,
} from "lucide-react";

type PlanType = "FREE" | "CREATOR" | "PRO" | "PREMIUM";

interface SubscriptionInfo {
  plan: PlanType;
  status: string | null;          // "active" | "cancelled" | "expired" | null (FREE)
  credits: number;
  currentPeriodEnd: string | null;
  createdAt: string | null;
  lemonSubscriptionId: string | null;
}

const PLAN_CONFIG: Record<PlanType, { label: string; color: string; gradient: string; monthlyCredits: number }> = {
  FREE:    { label: "Free Plan",    color: "text-gray-400",    gradient: "from-gray-500 to-gray-600",      monthlyCredits: 10  },
  CREATOR: { label: "Creator Plan", color: "text-cyan-400",    gradient: "from-cyan-500 to-teal-500",      monthlyCredits: 200 },
  PRO:     { label: "Pro Plan",     color: "text-indigo-400",  gradient: "from-indigo-500 to-purple-500",  monthlyCredits: 500 },
  PREMIUM: { label: "Premium Plan", color: "text-amber-400",   gradient: "from-amber-500 to-orange-500",   monthlyCredits: 1500 },
};

function daysLeft(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const diff = new Date(dateIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function MyAccountPage() {
  const { user } = useUser();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetch("/api/my-subscription")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load subscription");
        return res.json();
      })
      .then(data => setSub(data))
      .catch(() => setError("Could not load your subscription details."))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll keep access until the end of your current billing period.")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSub(prev => prev ? { ...prev, status: "cancelled" } : prev);
      alert("Your subscription has been cancelled. You'll retain access until the period ends.");
    } catch {
      alert("Failed to cancel subscription. Please contact support.");
    } finally {
      setCancelling(false);
    }
  };

  const plan = sub?.plan || "FREE";
  const cfg = PLAN_CONFIG[plan];
  const remaining = daysLeft(sub?.currentPeriodEnd ?? null);
  const isActive = sub?.status === "active";
  const isCancelled = sub?.status === "cancelled";

  return (
    <div className="min-h-screen bg-[#030305] text-white font-sans">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.05),transparent_50%)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#030305]/80 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-500 hover:text-white transition text-sm">
            <ArrowLeft size={15} /> Back
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <span className="font-black text-base text-white">My Account</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={28} className="animate-spin text-cyan-500" />
            <p className="text-sm text-gray-500 font-mono">Loading your subscription...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <>
            {/* ── Profile summary ── */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-xl font-black text-black flex-shrink-0">
                {user?.firstName?.[0] || user?.username?.[0] || "U"}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{user?.fullName || user?.username || "Account"}</p>
                <p className="text-xs text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>

            {/* ── Subscription card ── */}
            <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${cfg.gradient} p-[1px]`}>
              <div className="rounded-3xl bg-[#0a0a0f] p-6 space-y-5">

                {/* Plan header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
                      <Crown size={18} className="text-black" />
                    </div>
                    <div>
                      <p className={`text-lg font-black ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-[11px] text-gray-500 font-mono">
                        {plan === "FREE" ? "No active subscription" : `Subscribed since ${formatDate(sub?.createdAt ?? null)}`}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  {plan !== "FREE" && (
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                      isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : isCancelled ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : "text-red-400 bg-red-500/10 border-red-500/20"
                    }`}>
                      {isActive ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                      {isActive ? "Active" : isCancelled ? "Cancelling" : sub?.status || "Inactive"}
                    </span>
                  )}
                </div>

                {plan === "FREE" ? (
                  /* ── حالة الخطة المجانية ── */
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      You're currently on the Free plan with limited credits. Upgrade to unlock more AI generations every month.
                    </p>
                    <Link href="/#pricing"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-black text-sm hover:opacity-90 transition">
                      <Zap size={14} /> Upgrade Plan
                    </Link>
                  </div>
                ) : (
                  /* ── حالة الاشتراك النشط ── */
                  <div className="space-y-4">
                    {/* Renewal info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono uppercase mb-1.5">
                          <Calendar size={11} /> {isCancelled ? "Access until" : "Renews on"}
                        </div>
                        <p className="text-sm font-bold text-white">{formatDate(sub?.currentPeriodEnd ?? null)}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono uppercase mb-1.5">
                          <Clock size={11} /> Days remaining
                        </div>
                        <p className="text-sm font-bold text-white">
                          {remaining !== null ? `${remaining} ${remaining === 1 ? "day" : "days"}` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar للأيام المتبقية */}
                    {remaining !== null && (
                      <div className="space-y-1.5">
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${cfg.gradient} rounded-full transition-all`}
                            style={{ width: `${Math.min(100, Math.max(4, (remaining / 30) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {isCancelled && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-300 leading-relaxed">
                          Your subscription has been cancelled and won't renew. You'll keep full access until {formatDate(sub?.currentPeriodEnd ?? null)}.
                        </p>
                      </div>
                    )}

                    {/* Credits */}
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-cyan-400" />
                        <span className="text-xs text-gray-400 font-mono">Current balance</span>
                      </div>
                      <span className="text-sm font-black text-cyan-400">💎 {sub?.credits ?? 0} credits</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {!isCancelled && (
                        <button
                          onClick={handleCancel}
                          disabled={cancelling}
                          className="flex-1 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold hover:bg-red-500/10 transition disabled:opacity-50"
                        >
                          {cancelling ? "Cancelling..." : "Cancel Subscription"}
                        </button>
                      )}
                      <Link href="/#pricing"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-black text-xs font-black hover:opacity-90 transition">
                        <Zap size={12} /> {isCancelled ? "Resubscribe" : "Change Plan"}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Billing history link ── */}
            <Link href="/dashboard/billing"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-4 transition group">
              <div className="flex items-center gap-3">
                <CreditCard size={16} className="text-gray-500" />
                <span className="text-sm text-gray-300">Billing History & Invoices</span>
              </div>
              <ExternalLink size={14} className="text-gray-600 group-hover:text-gray-400 transition" />
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
