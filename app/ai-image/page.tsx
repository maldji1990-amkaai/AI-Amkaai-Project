"use client";

import { useEffect, useState } from "react";

export default function AIImagePage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "premium" | null>(null);

  const [file, setFile] = useState<File | null>(null);

  const [timeLeft, setTimeLeft] = useState(600);

  // ⏳ Countdown
  useEffect(() => {
    if (!showUpgrade) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [showUpgrade]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // 🎯 Generate
  const generateImage = async () => {
    if (!prompt) return;

    setLoading(true);
    setError("");
    setImage("");

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (data.error?.includes("limit")) {
        setShowUpgrade(true);
        await fetch("/api/abandoned", { method: "POST" });
        return;
      }

      if (!res.ok) setError(data.error || "Error");
      else setImage(data.image);
    } catch {
      setError("Server error");
    }

    setLoading(false);
  };

  // ✨ Enhance
  const enhanceImage = async () => {
    if (!prompt) return;

    setEnhancing(true);
    setError("");

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        body: JSON.stringify({
          prompt:
            prompt +
            ", ultra realistic, 4k, high quality, highly detailed",
        }),
      });

      const data = await res.json();

      if (data.error?.includes("limit")) {
        setShowUpgrade(true);
        await fetch("/api/abandoned", { method: "POST" });
        return;
      }

      if (!res.ok) setError(data.error || "Enhance failed");
      else setImage(data.image);
    } catch {
      setError("Server error");
    }

    setEnhancing(false);
  };

  // 💳 Stripe
  const goToCheckout = async (plan: "pro" | "premium") => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  // 💰 Crypto redirect
  const goToCrypto = async () => {
    const res = await fetch("/api/crypto-checkout", {
      method: "POST",
    });

    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  // 🇩🇿 Submit Baridi
  const submitBaridi = async () => {
    if (!file || !selectedPlan) return alert("Upload screenshot");

    const form = new FormData();
    form.append("file", file);
    form.append("plan", selectedPlan.toUpperCase());

    await fetch("/api/manual-payment", {
      method: "POST",
      body: form,
    });

    alert("Payment sent! Waiting approval ✅");
    setSelectedPlan(null);
    setShowUpgrade(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center">

      <h1 className="text-3xl mb-6">🎨 AI Image Generator</h1>

      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your image..."
        className="w-full max-w-xl p-3 rounded-xl bg-white/10 border border-white/20 mb-4 outline-none"
      />

      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={generateImage}
          className="px-6 py-3 bg-cyan-500 rounded-xl text-black font-bold"
        >
          {loading ? "Generating..." : "Generate"}
        </button>

        <button
          onClick={enhanceImage}
          disabled={!image}
          className="px-6 py-3 bg-purple-500 rounded-xl"
        >
          {enhancing ? "Enhancing..." : "Enhance ✨"}
        </button>

        {image && (
          <a
            href={image}
            download="ai-image.png"
            className="px-6 py-3 bg-green-500 rounded-xl text-black font-semibold"
          >
            Download 📥
          </a>
        )}
      </div>

      {error && <div className="mt-6 text-red-400">{error}</div>}

      {image && (
        <div className="mt-6 relative group">
          <img src={image} className="rounded-xl max-w-xl" />

          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
            <button
              onClick={() => setShowUpgrade(true)}
              className="bg-yellow-500 px-4 py-2 rounded"
            >
              Upgrade 💰
            </button>
          </div>
        </div>
      )}

      {/* 🔥 PAYMENT MODAL */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">

          <div className="bg-[#0f0f0f] p-6 rounded-xl w-full max-w-md">

            <p className="text-center text-red-400 mb-4">
              ⏳ Offer ends in {formatTime(timeLeft)}
            </p>

            {/* اختيار الخطة */}
            {!selectedPlan ? (
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedPlan("pro")}
                  className="w-full bg-cyan-500 py-2 rounded-xl text-black font-bold"
                >
                  PRO — 15 USD / 15 USDT / 4500 DZD
                </button>

                <button
                  onClick={() => setSelectedPlan("premium")}
                  className="w-full bg-yellow-500 py-2 rounded-xl text-black font-bold"
                >
                  PREMIUM — 25 USD / 25 USDT / 7500 DZD
                </button>
              </div>
            ) : (
              <div className="space-y-4">

                {/* STRIPE */}
                <button
                  onClick={() => goToCheckout(selectedPlan)}
                  className="w-full bg-cyan-500 py-2 rounded-xl text-black font-bold"
                >
                  💳 Pay with Card
                </button>

                {/* CRYPTO */}
                <div className="bg-green-500/10 p-3 rounded-xl">
                  <p className="text-sm mb-1">USDT (TRC20)</p>

                  <div className="flex justify-between text-xs bg-black/40 p-2 rounded">
                    <span>YOUR_USDT_ADDRESS</span>
                    <button onClick={() => navigator.clipboard.writeText("YOUR_USDT_ADDRESS")}>
                      Copy
                    </button>
                  </div>
                </div>

                {/* BARIDI */}
                <div className="bg-blue-500/10 p-3 rounded-xl">
                  <p className="text-sm mb-1">BaridiMob 🇩🇿</p>

                  <div className="flex justify-between text-xs bg-black/40 p-2 rounded">
                    <span>YOUR_RIP_HERE</span>
                    <button onClick={() => navigator.clipboard.writeText("YOUR_RIP_HERE")}>
                      Copy
                    </button>
                  </div>

                  <input
                    type="file"
                    className="mt-3 w-full"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />

                  <button
                    onClick={submitBaridi}
                    className="mt-2 w-full bg-green-500 py-2 rounded text-black"
                  >
                    Submit Screenshot
                  </button>
                </div>

              </div>
            )}

            <button
              onClick={() => {
                setShowUpgrade(false);
                setSelectedPlan(null);
              }}
              className="mt-4 w-full text-gray-400"
            >
              Cancel
            </button>

          </div>
        </div>
      )}

    </div>
  );
}