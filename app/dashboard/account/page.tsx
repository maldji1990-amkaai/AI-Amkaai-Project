"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  Crown,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Zap,
  Loader2,
  ExternalLink,
} from "lucide-react";

type PlanType =
  | "TRIAL"
  | "MONTHLY"
  | "QUARTERLY"
  | "BIANNUALLY"
  | "BUSINESS";

interface SubscriptionInfo {
  plan: PlanType;
  status: string | null;
  credits: number;
  currentPeriodEnd: string | null;
  createdAt: string | null;
  paypalSubscriptionId: string | null;
}

const PLAN_CONFIG: Record<
  PlanType,
  {
    label: string;
    color: string;
    gradient: string;
  }
> = {
  TRIAL: {
    label: "3-Day Trial",
    color: "text-gray-400",
    gradient: "from-gray-500 to-gray-600",
  },
  MONTHLY: {
    label: "Monthly Plan",
    color: "text-cyan-400",
    gradient: "from-cyan-500 to-teal-500",
  },
  QUARTERLY: {
    label: "Quarterly Saver",
    color: "text-indigo-400",
    gradient: "from-indigo-500 to-purple-500",
  },
  BIANNUALLY: {
    label: "6 Months Cinematic",
    color: "text-amber-400",
    gradient: "from-amber-500 to-orange-500",
  },
  BUSINESS: {
    label: "Business",
    color: "text-fuchsia-400",
    gradient: "from-fuchsia-500 to-pink-500",
  },
};

function daysLeft(
  dateIso: string | null
): number | null {
  if (!dateIso) return null;

  const timestamp =
    new Date(dateIso).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diff = timestamp - Date.now();

  return Math.max(
    0,
    Math.ceil(
      diff / (1000 * 60 * 60 * 24)
    )
  );
}

function formatDate(
  iso: string | null
): string {
  if (!iso) return "—";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}

export default function MyAccountPage() {
  const { user } = useUser();

  const [sub, setSub] =
    useState<SubscriptionInfo | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [cancelling, setCancelling] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      try {
        const res = await fetch(
          "/api/my-subscription",
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

        if (!res.ok) {
          throw new Error(
            "Failed to load subscription"
          );
        }

        const data =
          (await res.json()) as SubscriptionInfo;

        if (mounted) {
          setSub(data);
          setError(null);
        }
      } catch (err) {
        console.error(
          "[MY_ACCOUNT]",
          err
        );

        if (mounted) {
          setError(
            "Could not load your subscription details."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCancel = async () => {
    if (cancelling) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel your subscription? You'll keep access until the end of your current billing period."
    );

    if (!confirmed) return;

    setCancelling(true);

    try {
      const res = await fetch(
        "/api/subscription/cancel",
        {
          method: "POST",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

      const data =
        await res.json().catch(
          () => null
        );

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Cancellation failed"
        );
      }

      setSub((prev) =>
        prev
          ? {
              ...prev,
              status: "cancelled",
              currentPeriodEnd:
                data?.currentPeriodEnd ??
                prev.currentPeriodEnd,
            }
          : prev
      );

      window.alert(
        "Your subscription has been cancelled. You'll retain access until the period ends."
      );
    } catch (err) {
      console.error(
        "[CANCEL_SUBSCRIPTION]",
        err
      );

      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to cancel subscription. Please contact support."
      );
    } finally {
      setCancelling(false);
    }
  };

  const plan: PlanType =
    sub?.plan || "TRIAL";

  const cfg =
    PLAN_CONFIG[plan] ??
    PLAN_CONFIG.TRIAL;

  const remaining = daysLeft(
    sub?.currentPeriodEnd ?? null
  );

  const isActive =
    sub?.status === "active";

  const isCancelled =
    sub?.status === "cancelled";

  const isTrialNotStarted =
    plan === "TRIAL" &&
    !sub?.status;

  return (
    <div className="min-h-screen bg-[#030305] font-sans text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.05),transparent_50%)]" />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#030305]/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-white"
          >
            <ArrowLeft size={15} />
            Back
          </Link>

          <div className="h-4 w-px bg-white/10" />

          <span className="text-base font-black text-white">
            My Account
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <Loader2
              size={28}
              className="animate-spin text-cyan-500"
            />

            <p className="font-mono text-sm text-gray-500">
              Loading your subscription...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
            <AlertCircle
              size={28}
              className="text-red-400"
            />

            <p className="text-sm text-red-400">
              {error}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-500 text-xl font-black text-black">
                {user?.firstName?.[0] ||
                  user?.username?.[0] ||
                  "U"}
              </div>

              <div className="min-w-0">
                <p className="truncate font-bold text-white">
                  {user?.fullName ||
                    user?.username ||
                    "Account"}
                </p>

                <p className="truncate text-xs text-gray-500">
                  {
                    user
                      ?.primaryEmailAddress
                      ?.emailAddress
                  }
                </p>
              </div>
            </div>

            <div
              className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${cfg.gradient} p-[1px]`}
            >
              <div className="space-y-5 rounded-3xl bg-[#0a0a0f] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${cfg.gradient}`}
                    >
                      <Crown
                        size={18}
                        className="text-black"
                      />
                    </div>

                    <div>
                      <p
                        className={`text-lg font-black ${cfg.color}`}
                      >
                        {cfg.label}
                      </p>

                      <p className="font-mono text-[11px] text-gray-500">
                        {isTrialNotStarted
                          ? "No active subscription"
                          : `Subscribed since ${formatDate(
                              sub?.createdAt ??
                                null
                            )}`}
                      </p>
                    </div>
                  </div>

                  {!isTrialNotStarted && (
                    <span
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold ${
                        isActive
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : isCancelled
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                            : "border-red-500/20 bg-red-500/10 text-red-400"
                      }`}
                    >
                      {isActive ? (
                        <CheckCircle2
                          size={11}
                        />
                      ) : (
                        <AlertCircle
                          size={11}
                        />
                      )}

                      {isActive
                        ? "Active"
                        : isCancelled
                          ? "Cancelling"
                          : sub?.status ||
                            "Inactive"}
                    </span>
                  )}
                </div>

                {isTrialNotStarted ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      You haven't started your
                      free trial yet. Start now
                      to get 30 credits and 3
                      days of full access.
                    </p>

                    <Link
                      href="/#pricing"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 py-3 text-sm font-black text-black transition hover:opacity-90"
                    >
                      <Zap size={14} />
                      Start Free Trial
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase text-gray-500">
                          <Calendar size={11} />

                          {isCancelled
                            ? "Access until"
                            : "Renews on"}
                        </div>

                        <p className="text-sm font-bold text-white">
                          {formatDate(
                            sub?.currentPeriodEnd ??
                              null
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                        <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase text-gray-500">
                          <Clock size={11} />
                          Days remaining
                        </div>

                        <p className="text-sm font-bold text-white">
                          {remaining !== null
                            ? `${remaining} ${
                                remaining === 1
                                  ? "day"
                                  : "days"
                              }`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {remaining !== null && (
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${cfg.gradient} transition-all`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  4,
                                  (remaining /
                                    30) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {plan === "TRIAL" &&
                      isActive && (
                        <div className="flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                          <AlertCircle
                            size={14}
                            className="mt-0.5 flex-shrink-0 text-cyan-400"
                          />

                          <p className="text-[11px] leading-relaxed text-cyan-300">
                            You're in your
                            3-day free trial.
                            Your card will be
                            charged
                            automatically and
                            you'll move to the
                            Monthly plan when
                            the trial ends.
                          </p>
                        </div>
                      )}

                    {isCancelled && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <AlertCircle
                          size={14}
                          className="mt-0.5 flex-shrink-0 text-amber-400"
                        />

                        <p className="text-[11px] leading-relaxed text-amber-300">
                          Your subscription
                          has been cancelled
                          and won't renew.
                          You'll keep full
                          access until{" "}
                          {formatDate(
                            sub?.currentPeriodEnd ??
                              null
                          )}
                          .
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
                      <div className="flex items-center gap-2">
                        <CreditCard
                          size={14}
                          className="text-cyan-400"
                        />

                        <span className="font-mono text-xs text-gray-400">
                          Current balance
                        </span>
                      </div>

                      <span className="text-sm font-black text-cyan-400">
                        💎 {sub?.credits ?? 0}{" "}
                        credits
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={
                            handleCancel
                          }
                          disabled={
                            cancelling
                          }
                          className="flex-1 rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {cancelling
                            ? "Cancelling..."
                            : "Cancel Subscription"}
                        </button>
                      )}

                      <Link
                        href="/#pricing"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 py-2.5 text-xs font-black text-black transition hover:opacity-90"
                      >
                        <Zap size={12} />

                        {isCancelled
                          ? "Resubscribe"
                          : "Change Plan"}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/dashboard/billing"
              className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <CreditCard
                  size={16}
                  className="text-gray-500"
                />

                <span className="text-sm text-gray-300">
                  Billing History & Invoices
                </span>
              </div>

              <ExternalLink
                size={14}
                className="text-gray-600 transition group-hover:text-gray-400"
              />
            </Link>
          </>
        )}
      </main>
    </div>
  );
}