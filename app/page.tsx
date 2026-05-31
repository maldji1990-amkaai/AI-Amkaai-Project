"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  Sparkles,
  Video,
  Mic,
  BarChart3,
  ArrowRight,
  Play,
  ShieldCheck,
  Zap,
  Stars,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [visitors, setVisitors] = useState(1284);
  const [online, setOnline] = useState(18);

  const [loadingPlan, setLoadingPlan] = useState<
    "pro" | "premium" | null
  >(null);

  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [type, setType] = useState<"image" | "video" | "voice">("image");

  //////////////////////////////////////////////////
  // 📊 LIVE STATS
  //////////////////////////////////////////////////

  useEffect(() => {
    const interval = setInterval(() => {
      setVisitors(
        (v) => v + Math.floor(Math.random() * 3)
      );

      setOnline(
        10 + Math.floor(Math.random() * 40)
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  //////////////////////////////////////////////////
  // ✨ AI TYPING EFFECT
  //////////////////////////////////////////////////

  //////////////////////////////////////////////////
  // 🌈 CURSOR GLOW
  //////////////////////////////////////////////////

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const glow = document.getElementById(
        "cursor-glow"
      );

      if (glow) {
        glow.style.left = `${e.clientX}px`;
        glow.style.top = `${e.clientY}px`;
      }
    };

    window.addEventListener("mousemove", move);

    return () =>
      window.removeEventListener(
        "mousemove",
        move
      );
  }, []);

  //////////////////////////////////////////////////
  // 💳 CHECKOUT
  //////////////////////////////////////////////////

  const goToCheckout = async (
    plan: "pro" | "premium"
  ) => {
    try {
      setLoadingPlan(plan);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!data?.url) {
        alert("Checkout failed");
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setLoadingPlan(null);
    }
  };

  //////////////////////////////////////////////////
  // ⚡ DEMO AI
  //////////////////////////////////////////////////
const generateAI = async () => {
  if (!prompt.trim()) return;

  try {
    setLoadingAI(true);
    setResult("");

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        type, // ✅ هنا التصحيح
        demo: true,
      }),
    });

    const data = await res.json();

    setResult(data.output || "");

  } catch (err) {
    console.error(err);
  } finally {
    setLoadingAI(false);
  }
};

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">

      {/* 🌌 BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.15),transparent_35%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.15),transparent_35%)]" />

      {/* 🎥 VIDEO */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 h-full w-full object-cover opacity-20"
      >
        <source
          src="/demo.mp4"
          type="video/mp4"
        />
      </video>

      {/* 🌈 CURSOR GLOW */}
      <div
        id="cursor-glow"
        className="pointer-events-none fixed z-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/20 blur-3xl"
      />

      {/* DARK OVERLAY */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />

      {/* NAVBAR */}
     <header className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur-2xl">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

    {/* LOGO */}
    <motion.div
      initial={{
        opacity: 0,
        y: -20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
    >
      <Link
        href="/"
        className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-2xl font-black tracking-wider text-transparent"
      >
        AMKAAI
      </Link>
    </motion.div>

    {/* NAV LINKS */}
    <nav className="hidden items-center gap-8 text-sm text-gray-300 md:flex">

      <Link
        href="#features"
        className="transition hover:text-white"
      >
        Features
      </Link>

      <Link
        href="#pricing"
        className="transition hover:text-white"
      >
        Pricing
      </Link>

      <Link
        href="/dashboard"
        className="transition hover:text-white"
      >
        Dashboard
      </Link>

      <Link
        href="#"
        className="transition hover:text-white"
      >
        AI Studio
      </Link>
    </nav>

    {/* ACTIONS */}
    <div className="flex items-center gap-3">

      <Link
        href="/sign-in"
        className="hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-2 text-sm text-gray-300 transition hover:bg-white/10 md:flex"
      >
        Login
      </Link>

      <Link
        href="/dashboard"
        className="group flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 font-bold text-black transition hover:scale-105"
      >
        Get Started

        <ArrowRight
          size={16}
          className="transition group-hover:translate-x-1"
        />
      </Link>
    </div>
  </div>
</header>

      {/* HERO */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-28 text-center">

        {/* BADGE */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mb-8 flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-5 py-2 text-sm text-cyan-300 backdrop-blur-xl"
        >
          <Stars size={16} />
          AI Powered Creative Platform
        </motion.div>

        {/* TITLE */}
        <motion.h1
          initial={{
            opacity: 0,
            y: 40,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
          }}
          className="max-w-5xl text-5xl font-black leading-tight md:text-7xl"
        >
          Create
          <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {" "}
            Cinematic AI{" "}
          </span>
          Videos In Seconds
        </motion.h1>

        {/* SUBTITLE */}
        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.2,
          }}
          className="mt-8 max-w-2xl text-lg leading-relaxed text-gray-400"
        >
          Generate ultra realistic AI videos,
          voices and images with next-gen
          artificial intelligence tools.
        </motion.p>

        {/* STATS */}
        <div className="mt-12 flex flex-wrap justify-center gap-5">
          <Stat
            value={`${visitors}+`}
            label="Creators"
          />

          <Stat
            value={`${online}`}
            label="Online Now"
          />

          <Stat
            value="99.9%"
            label="Uptime"
          />
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-wrap justify-center gap-5">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-bold text-black transition hover:scale-105"
          >
            Start Free
            <ArrowRight
              size={18}
              className="transition group-hover:translate-x-1"
            />
          </Link>

          <button
            onClick={() =>
              goToCheckout("pro")
            }
            className="rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500 to-purple-500 px-8 py-4 font-bold shadow-[0_0_40px_rgba(34,211,238,0.35)] transition hover:scale-105"
          >
            {loadingPlan === "pro"
              ? "Redirecting..."
              : "Upgrade Pro"}
          </button>
        </div>

        {/* TRUST */}
        <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
          <ShieldCheck
            size={16}
            className="text-cyan-400"
          />
          Secure payments powered by Lemon
          Squeezy
        </div>
      </section>

      {/* DEMO */}
{/* DEMO */}
<section className="relative z-10 mx-auto max-w-5xl px-6 pb-32">
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-2xl"
  >
    <div className="mb-6 flex items-center gap-3">
      <Play className="text-cyan-400" />
      <h2 className="text-2xl font-bold">AI Prompt Studio</h2>
    </div>

    <textarea
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      placeholder="Describe your cinematic scene..."
      className="h-40 w-full rounded-2xl border border-white/10 bg-black/40 p-5 text-white outline-none transition focus:border-cyan-400"
    />

    <div className="flex gap-3 mt-4 justify-center">
      <button onClick={() => setType("image")} className={`px-4 py-2 rounded-xl ${type === "image" ? "bg-cyan-500 text-black" : "bg-white/10"}`}>
        🖼 Image
      </button>

      <button onClick={() => setType("video")} className={`px-4 py-2 rounded-xl ${type === "video" ? "bg-cyan-500 text-black" : "bg-white/10"}`}>
        🎬 Video
      </button>

      <button onClick={() => setType("voice")} className={`px-4 py-2 rounded-xl ${type === "voice" ? "bg-cyan-500 text-black" : "bg-white/10"}`}>
        🎤 Voice
      </button>
    </div>

    <button
      onClick={generateAI}
      className="mt-5 rounded-2xl bg-cyan-500 px-6 py-3 font-bold text-black transition hover:scale-105"
    >
      {loadingAI ? "Generating..." : "Generate AI Prompt"}
    </button>

    {/* RESULT */}
    <div className="mt-8 min-h-[200px] rounded-2xl border border-white/10 bg-black/40 p-5 flex flex-col items-center justify-center gap-4">

      {!result && (
        <p className="text-gray-400">
          AI generated output will appear here...
        </p>
      )}

      {result &&
        result.startsWith("http") &&
        /\.(jpg|jpeg|png|webp)$/i.test(result) && (
          <img src={result} className="rounded-xl max-h-[300px]" />
      )}

      {result &&
        result.startsWith("http") &&
        /\.(mp4)$/i.test(result) && (
          <video src={result} controls className="rounded-xl max-h-[300px]" />
      )}

      {result &&
        result.startsWith("http") &&
        /\.(mp3)$/i.test(result) && (
          <audio src={result} controls />
      )}

    </div>

  </motion.div>
</section>

      {/* FEATURES */}
      <section
        id="features"
        className="relative z-10 mx-auto grid max-w-7xl gap-6 px-6 pb-32 md:grid-cols-4"
      >
        <Feature
          icon={<Sparkles />}
          title="AI Images"
          text="Generate stunning visuals instantly."
        />

        <Feature
          icon={<Mic />}
          title="AI Voices"
          text="Realistic human voice generation."
        />

        <Feature
          icon={<Video />}
          title="AI Videos"
          text="Cinematic video creation with AI."
        />

        <Feature
          icon={<BarChart3 />}
          title="Analytics"
          text="Track your AI generation usage."
        />
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        className="relative z-10 mx-auto max-w-6xl px-6 pb-32"
      >

        <div className="mb-16 text-center">
          <h2 className="text-5xl font-black">
            Pricing
          </h2>

          <p className="mt-4 text-gray-400">
            Scale your creativity with premium
            AI power.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">

          <PricingCard
            title="PRO"
            price="$15"
            description="Perfect for creators."
            features={[
              "AI Video Generation",
              "AI Voice Studio",
              "Priority Queue",
              "HD Rendering",
            ]}
            buttonText={
              loadingPlan === "pro"
                ? "Redirecting..."
                : "Choose Pro"
            }
            onClick={() =>
              goToCheckout("pro")
            }
          />

          <PricingCard
            title="PREMIUM"
            price="$25"
            description="For power users & agencies."
            highlighted
            features={[
              "Everything in Pro",
              "4K Rendering",
              "Fastest Queue",
              "Premium AI Models",
            ]}
            buttonText={
              loadingPlan === "premium"
                ? "Redirecting..."
                : "Choose Premium"
            }
            onClick={() =>
              goToCheckout("premium")
            }
          />
        </div>
      </section>
    </main>
  );
}

//////////////////////////////////////////////////
// 📊 STAT
//////////////////////////////////////////////////

function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-7 py-5 backdrop-blur-xl">
      <p className="text-center text-3xl font-black text-cyan-400">
        {value}
      </p>

      <p className="mt-1 text-center text-sm text-gray-400">
        {label}
      </p>
    </div>
  );
}

//////////////////////////////////////////////////
// ⚡ FEATURE
//////////////////////////////////////////////////

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <motion.div
      whileHover={{
        y: -5,
      }}
      className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
    >
      <div className="mb-5 text-cyan-400">
        {icon}
      </div>

      <h3 className="text-2xl font-bold">
        {title}
      </h3>

      <p className="mt-3 text-gray-400">
        {text}
      </p>
    </motion.div>
  );
}

//////////////////////////////////////////////////
// 💰 PRICING CARD
//////////////////////////////////////////////////

function PricingCard({
  title,
  price,
  description,
  features,
  buttonText,
  highlighted,
  onClick,
}: any) {
  return (
    <motion.div
      whileHover={{
        scale: 1.02,
      }}
      className={`relative overflow-hidden rounded-3xl border p-10 backdrop-blur-2xl ${
        highlighted
          ? "border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_60px_rgba(34,211,238,0.2)]"
          : "border-white/10 bg-white/5"
      }`}
    >
      {highlighted && (
        <div className="absolute right-4 top-4 rounded-full bg-cyan-400 px-3 py-1 text-xs font-bold text-black">
          MOST POPULAR
        </div>
      )}

      <h3 className="text-3xl font-black">
        {title}
      </h3>

      <p className="mt-4 text-6xl font-black">
        {price}
      </p>

      <p className="mt-4 text-gray-400">
        {description}
      </p>

      <div className="mt-8 space-y-4">
        {features.map(
          (
            feature: string,
            index: number
          ) => (
            <div
              key={index}
              className="flex items-center gap-3 text-gray-300"
            >
              <Zap
                size={16}
                className="text-cyan-400"
              />

              {feature}
            </div>
          )
        )}
      </div>

      <button
        onClick={onClick}
        className={`mt-10 w-full rounded-2xl py-4 font-bold transition hover:scale-[1.02] ${
          highlighted
            ? "bg-cyan-400 text-black"
            : "bg-white text-black"
        }`}
      >
        {buttonText}
      </button>
    </motion.div>
  );
}