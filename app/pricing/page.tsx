"use client";

import { useState, useEffect } from "react";

const PLANS = {
  pro: {
    usd: 15,
    usdt: 15,
    dzd: 4500,
    credits: 150,
  },
  premium: {
    usd: 25,
    usdt: 25,
    dzd: 7500,
    credits: 500,
  },
};

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] =
    useState<"pro" | "premium" | null>(null);

  const [paymentInfo, setPaymentInfo] = useState({
    rip: "",
    usdt: "",
  });

  const [loadingCheckout, setLoadingCheckout] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payment-info")
      .then((res) => res.json())
      .then((data) => {
        setPaymentInfo({
          rip: data?.rip || "N/A",
          usdt: data?.usdt || "N/A",
        });
      })
      .catch(() => {
        setPaymentInfo({
          rip: "N/A",
          usdt: "N/A",
        });
      });
  }, []);

  const goToCheckout = async (
    plan: "pro" | "premium"
  ) => {
    try {
      setLoadingCheckout(true);
      setError(null);

      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
        }),
      });

      const text = await res.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Invalid server response (${res.status})`
        );
      }

      if (!res.ok) {
        throw new Error(
          data?.error ||
            `Checkout failed (${res.status})`
        );
      }

      if (!data?.url) {
        throw new Error(
          "Checkout URL missing"
        );
      }

      window.location.assign(data.url);

    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Checkout failed"
      );
    } finally {
      setLoadingCheckout(false);
    }
  };

  const plan =
    selectedPlan
      ? PLANS[selectedPlan]
      : null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">

      <h1 className="text-5xl font-bold mb-3 text-center">
        AI Video SaaS 🚀
      </h1>

      <p className="text-gray-400 mb-10 text-center">
        Unlock premium AI generation tools
      </p>

      <button
        onClick={() =>
          (window.location.href =
            "/dashboard")
        }
        className="mb-10 bg-white text-black px-6 py-3 rounded-xl font-bold"
      >
        🎬 Try Free Dashboard
      </button>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">

        <PlanCard
          title="Pro"
          price="$15"
          credits="150 credits"
          onClick={() =>
            setSelectedPlan("pro")
          }
        />

        <PlanCard
          title="Premium"
          price="$25"
          credits="500 credits"
          highlight
          onClick={() =>
            setSelectedPlan(
              "premium"
            )
          }
        />

      </div>

      {selectedPlan &&
        plan && (
          <Modal>

            <h2 className="text-xl font-bold text-center mb-2">
              Complete Payment
            </h2>

            <p className="text-center text-gray-400 mb-6">
              {plan.usd} USD •{" "}
              {plan.usdt} USDT •{" "}
              {plan.dzd} DZD
            </p>

            {error && (
              <div className="mb-4 rounded bg-red-500/20 border border-red-500 p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={() =>
                goToCheckout(
                  selectedPlan
                )
              }
              disabled={
                loadingCheckout
              }
              className="w-full bg-cyan-500 text-black py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {loadingCheckout
                ? "Processing..."
                : "💳 Pay with Card"}
            </button>

            <div className="grid grid-cols-2 gap-4 mt-5">

              <PaymentBox
                title="USDT"
                value={
                  paymentInfo.usdt
                }
              />

              <PaymentBox
                title="BaridiMob"
                value={
                  paymentInfo.rip
                }
              />

            </div>

            <button
              onClick={() => {
                setSelectedPlan(
                  null
                );
                setError(null);
              }}
              className="mt-5 text-gray-400 w-full"
            >
              Close
            </button>

          </Modal>
        )}

    </main>
  );
}

function PlanCard({
  title,
  price,
  credits,
  highlight,
  onClick,
}: any) {
  return (
    <div
      onClick={onClick}
      className={`p-8 rounded-2xl cursor-pointer border ${
        highlight
          ? "border-cyan-500 bg-cyan-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <h2 className="text-2xl font-bold">
        {title}
      </h2>

      <p className="text-3xl font-bold mt-2">
        {price}
      </p>

      <p className="text-gray-400 mt-1">
        {credits}
      </p>

      <button className="mt-5 w-full bg-white text-black py-3 rounded-xl">
        Choose
      </button>

    </div>
  );
}

function PaymentBox({
  title,
  value,
}: any) {
  return (
    <div className="p-4 border border-white/10 rounded-xl">

      <p>{title}</p>

      <p className="text-xs break-all">
        {value}
      </p>

      <button
        onClick={() =>
          navigator.clipboard.writeText(
            value
          )
        }
        className="mt-2 w-full bg-white/10 py-1 rounded"
      >
        Copy
      </button>

    </div>
  );
}

function Modal({
  children,
}: any) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center">

      <div className="bg-[#0f0f0f] p-8 rounded-2xl w-full max-w-md">

        {children}

      </div>

    </div>
  );
}