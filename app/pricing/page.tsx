"use client";

import { useState, useEffect } from "react";

const PLANS = {
  creator: {
    id: "creator",
    usd: 7,
    usdt: 7,
    dzd: 2100,
    credits: 70,
    features: ["70 Monthly Credits", "Optimized 480p Quality", "1 Credit = 1 Second of Video", "No Watermark Downloads"],
  },
  pro: {
    id: "pro",
    usd: 15,
    usdt: 15,
    dzd: 4500,
    credits: 200, // تمت زيادتها لـ 200 لتتناسب مع الـ 15$ ديناميكياً وتنافسياً
    features: ["200 Monthly Credits", "Cinematic HD 720p Quality", "Turbo Rendering Process", "Commercial License"],
  },
  premium: {
    id: "premium",
    usd: 25,
    usdt: 25,
    dzd: 7500,
    credits: 400, // تمت موازنتها لـ 400 نقطة لتتناسب مع قيمة الـ 25$ بدقة
    features: ["400 Monthly Credits", "Studio Full HD 1080p Quality", "Priority Queue (Instant)", "VIP Support 24/7"],
  },
};

type PlanKey = "creator" | "pro" | "premium";

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [paymentInfo, setPaymentInfo] = useState({ rip: "", usdt: "" });
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
        setPaymentInfo({ rip: "N/A", usdt: "N/A" });
      });
  }, []);

  const goToCheckout = async (plan: PlanKey) => {
    try {
      setLoadingCheckout(true);
      setError(null);

      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid server response (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Checkout failed (${res.status})`);
      }

      if (!data?.url) {
        throw new Error("Checkout URL missing");
      }

      window.location.assign(data.url);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Checkout failed");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const plan = selectedPlan ? PLANS[selectedPlan] : null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-start px-6 py-16 font-sans">
      
      {/* 1. Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-14">
        <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-white via-neutral-300 to-neutral-500 bg-clip-text text-transparent tracking-tight">
          Flexible Cinematic Plans 🎬
        </h1>
        <p className="text-neutral-400 text-base max-w-lg mx-auto mb-8 leading-relaxed">
          Unlock the true potential of AI generation. Choose a budget-friendly plan with a smart credit-based system.
        </p>
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="bg-white text-black px-8 py-3.5 rounded-xl font-bold shadow-xl hover:bg-neutral-200 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          🚀 Try Free Dashboard
        </button>
      </div>

      {/* 2. Pricing Cards Grid (Three Columns now) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl mb-16 items-stretch">
        <PlanCard
          title="Creator Pass"
          price={`$${PLANS.creator.usd}`}
          originalPrice="$14"
          credits={`${PLANS.creator.credits} Credits`}
          creditsDetail="1 point = 1 second of video generation"
          features={PLANS.creator.features}
          onClick={() => setSelectedPlan("creator")}
          borderColor="border-cyan-500/20 bg-cyan-500/[0.02]"
        />
        <PlanCard
          title="Pro Pack"
          price={`$${PLANS.pro.usd}`}
          originalPrice="$30"
          credits={`${PLANS.pro.credits} Credits`}
          creditsDetail="Flexible use for ultra cinematic content"
          features={PLANS.pro.features}
          highlight
          onClick={() => setSelectedPlan("pro")}
          borderColor="border-purple-500 bg-purple-500/5 shadow-purple-500/5 shadow-2xl"
        />
        <PlanCard
          title="Premium Studio"
          price={`$${PLANS.premium.usd}`}
          originalPrice="$50"
          credits={`${PLANS.premium.credits} Credits`}
          creditsDetail="Designed for pro agencies & top directors"
          features={PLANS.premium.features}
          onClick={() => setSelectedPlan("premium")}
          borderColor="border-amber-500/20 bg-amber-500/[0.02]"
        />
      </div>

      {/* 3. Trust & Security Badges */}
      <div className="max-w-xl mx-auto text-center border-t border-white/10 pt-8 mb-16 w-full">
        <p className="text-sm text-neutral-400 mb-3">🔒 Secured and encrypted automated checkouts</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-neutral-500 font-medium">
          <span>• Card Processing via Lemon Squeezy</span>
          <span>• Supports Credit Card, USDT & BaridiMob</span>
        </div>
      </div>

      {/* 4. Features Comparison Table */}
      <div className="w-full max-w-4xl mb-20 bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <h3 className="text-xl font-bold mb-6 text-center text-white">Full Feature Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 text-sm">
                <th className="pb-3 font-medium">Feature</th>
                <th className="pb-3 font-medium">Creator Pass</th>
                <th className="pb-3 font-medium text-purple-400">Pro Pack</th>
                <th className="pb-3 font-medium text-amber-400">Premium Studio</th>
              </tr>
            </thead>
            <tbody className="text-neutral-300 divide-y divide-white/5 text-xs sm:text-sm">
              <tr>
                <td className="py-4 font-medium text-white">AI Generation Credits</td>
                <td className="py-4">70 Credits</td>
                <td className="py-4 font-semibold text-purple-400">200 Credits</td>
                <td className="py-4 font-bold text-amber-400">400 Credits</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-white">Consumption Model</td>
                <td className="py-4 text-neutral-400">1 credit = 1 second</td>
                <td className="py-4 text-neutral-400">1 credit = 1 second</td>
                <td className="py-4 text-neutral-400">1 credit = 1 second</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-white">Maximum Quality</td>
                <td className="py-4 text-cyan-400">Optimized 480p</td>
                <td className="py-4 text-purple-400 font-semibold">Cinematic HD 720p</td>
                <td className="py-4 text-amber-400 font-bold">Studio Full HD 1080p</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-white">Rendering Queue</td>
                <td className="py-4">Standard Fast</td>
                <td className="py-4">Turbo Queue</td>
                <td className="py-4 font-bold text-amber-400">Instant VIP Priority</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-white">Watermark Free</td>
                <td className="py-4">✓ Yes</td>
                <td className="py-4">✓ Yes</td>
                <td className="py-4">✓ Yes</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-white">Customer Support</td>
                <td className="py-4">Standard</td>
                <td className="py-4">Priority Email</td>
                <td className="py-4 text-amber-400">VIP Direct 24/7</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. FAQ Section */}
      <div className="w-full max-w-3xl border-t border-white/10 pt-12">
        <h3 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h3>
        <div className="space-y-4">
          {[
            { q: "How does the credit consumption model work?", a: "To make it completely fair, we charge per second. Generating 1 second of cinematic video costs 1 credit. If you make a 5-second video, it deducts 5 credits. Generating ultra-realistic photos or AI voices takes just 1 credit per execution." },
            { q: "Can I cancel my subscription anytime?", a: "Yes, you can easily cancel your automated card subscription from your profile dashboard at any time without any hidden extra fees." },
            { q: "How do USDT and BaridiMob options work?", a: "When you select a plan, you can copy our wallet address or RIP. After making the transfer manually, please contact our support team with your transaction proof to activate your credits instantly." },
            { q: "Is card payment safe here?", a: "Absolutely. We route all credit card payments securely via Lemon Squeezy, ensuring total encryption, industry-standard safety, and instant activation." }
          ].map((item, index) => (
            <div key={index} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full text-left p-5 font-medium text-white flex justify-between items-center hover:bg-white/10"
              >
                <span>{item.q}</span>
                <span className="text-neutral-400">{openFaq === index ? "−" : "+"}</span>
              </button>
              {openFaq === index && (
                <div className="p-5 pt-0 text-neutral-400 text-sm leading-relaxed border-t border-white/5 bg-white/[0.02]">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Checkout Modal Component */}
      {selectedPlan && plan && (
        <Modal>
          <h2 className="text-xl font-bold text-center mb-2">Complete Payment</h2>
          <p className="text-center text-xs text-neutral-400 mb-1 font-medium tracking-wide uppercase">
            Plan: {selectedPlan === "creator" ? "Creator Pass" : selectedPlan === "pro" ? "Pro Pack" : "Premium Studio"}
          </p>
          
          <p className="text-center text-sm font-bold text-cyan-400 mb-6 bg-white/5 py-2.5 rounded-xl border border-white/5">
            {plan.usd} USD • {plan.usdt} USDT • {plan.dzd} DZD
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-red-300 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <button
            onClick={() => goToCheckout(selectedPlan)}
            disabled={loadingCheckout}
            className="w-full bg-cyan-500 text-black py-3.5 rounded-xl font-bold disabled:opacity-50 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/10"
          >
            {loadingCheckout ? "Processing Secure Checkout..." : "💳 Pay with Card (Instant)"}
          </button>

          <div className="text-center my-5 text-[10px] text-neutral-500 font-bold uppercase tracking-widest border-t border-white/5 pt-4">
            OR USE MANUAL TRANSFER BELOW
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PaymentBox title="USDT Wallet Address" value={paymentInfo.usdt} />
            <PaymentBox title="BaridiMob (RIP)" value={paymentInfo.rip} />
          </div>

          <button
            onClick={() => {
              setSelectedPlan(null);
              setError(null);
            }}
            className="mt-6 text-neutral-500 hover:text-neutral-300 transition-colors w-full text-center block text-xs font-semibold uppercase tracking-wider"
          >
            Cancel & Close Window
          </button>
        </Modal>
      )}

    </main>
  );
}

function PlanCard({ title, price, originalPrice, credits, creditsDetail, features, highlight, onClick, borderColor }: any) {
  return (
    <div
      onClick={onClick}
      className={`p-8 rounded-3xl cursor-pointer border flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 relative backdrop-blur-md ${borderColor} ${
        highlight ? "border-purple-500" : "hover:border-white/20 border-white/10"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 bg-purple-500 text-white text-[10px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wider shadow-md shadow-purple-500/20">
          Most Popular
        </span>
      )}
      {!highlight && (
        <span className="absolute top-3 right-3 text-[9px] text-neutral-500 font-bold border border-neutral-800 px-2 py-0.5 rounded-full uppercase">
          50% OFF
        </span>
      )}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          {title === "Creator Pass" ? "🎬" : title === "Pro Pack" ? "🔥" : "👑"} {title}
        </h2>
        
        <div className="flex items-baseline gap-2 mt-4">
          <p className="text-4xl font-black text-white">{price}</p>
          <span className="text-sm text-neutral-500 line-through font-medium">{originalPrice}</span>
          <span className="text-neutral-400 text-xs">/mo</span>
        </div>

        <div className="mt-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
          <p className="text-cyan-400 text-sm font-bold">{credits}</p>
          <p className="text-neutral-500 text-[11px] mt-0.5">{creditsDetail}</p>
        </div>
        
        <ul className="mt-6 space-y-3.5 border-t border-white/5 pt-5 text-xs sm:text-sm text-neutral-300">
          {features?.map((f: string, i: number) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="text-cyan-500 text-xs">✓</span> <span className="text-neutral-300 text-xs sm:text-sm">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <button className={`mt-8 w-full py-3 rounded-xl font-bold text-sm transition-all ${
        highlight 
          ? "bg-purple-500 text-white hover:bg-purple-400 shadow-lg shadow-purple-500/10" 
          : title === "Creator Pass"
          ? "bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/10"
          : "bg-white text-black hover:bg-neutral-200"
      }`}>
        Choose {title.split(" ")[0]}
      </button>
    </div>
  );
}

function PaymentBox({ title, value }: any) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: any) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3.5 border border-white/10 rounded-xl bg-white/[0.01] flex flex-col justify-between">
      <div>
        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">{title}</p>
        <p className="text-xs font-mono break-all text-white select-all font-medium">
          {value}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="mt-3 w-full bg-white/5 border border-white/5 text-xs py-1.5 rounded-lg hover:bg-white/10 text-white transition-colors font-medium"
      >
        {copied ? "Copied! ✓" : "Copy Info"}
      </button>
    </div>
  );
}