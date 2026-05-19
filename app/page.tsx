"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
import { useEffect, useRef, useState } from "react";

export default function HomePage() {
  const [visitors, setVisitors] = useState(1284);
  const [online, setOnline] = useState(18);

  const [loadingPlan, setLoadingPlan] =
    useState<"pro" | "premium" | null>(null);

  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);
  const [loadingAI, setLoadingAI] = useState(false);

  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [scene, setScene] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const scenes = ["/demo1.mp4", "/demo2.mp4", "/demo3.mp4"];

  const fullText =
    "✨ Cinematic drone shot over Tokyo at night, ultra realistic, neon reflections, volumetric lighting, cinematic camera movement.";

  //////////////////////////////////////////////////
  // 📊 LIVE STATS SYSTEM
  //////////////////////////////////////////////////
  useEffect(() => {
    const interval = setInterval(() => {
      setVisitors((v) => v + Math.floor(Math.random() * 3));
      setOnline(10 + Math.floor(Math.random() * 40));
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  //////////////////////////////////////////////////
  // 🌌 CURSOR + PARALLAX ENGINE
  //////////////////////////////////////////////////
  useEffect(() => {
    const move = (e: MouseEvent) => {
      setCursor({
        x: (e.clientX / window.innerWidth - 0.5) * 30,
        y: (e.clientY / window.innerHeight - 0.5) * 30,
      });
    };

    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  //////////////////////////////////////////////////
  // ✨ AI TYPE STREAM ENGINE
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!loadingAI) return;

    if (typingIndex < fullText.length) {
      const t = setTimeout(() => {
        setResult((p) => p + fullText[typingIndex]);
        setTypingIndex((i) => i + 1);
      }, 12);

      return () => clearTimeout(t);
    } else {
      setLoadingAI(false);
    }
  }, [typingIndex, loadingAI]);

  //////////////////////////////////////////////////
  // 🎬 SCENE ROTATOR (Kling style)
  //////////////////////////////////////////////////
  useEffect(() => {
    const interval = setInterval(() => {
      setScene((s) => (s + 1) % scenes.length);
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  //////////////////////////////////////////////////
  // 💳 CHECKOUT FLOW
  //////////////////////////////////////////////////
  const goToCheckout = async (plan: "pro" | "premium") => {
    try {
      setLoadingPlan(plan);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!data?.url) return alert("Checkout failed");

      window.location.href = data.url;
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlan(null);
    }
  };

  //////////////////////////////////////////////////
  // ⚡ AI GENERATION (RUNWAY STYLE)
  //////////////////////////////////////////////////
  const generateAI = () => {
    if (!prompt.trim()) return;

    setResult("");
    setTypingIndex(0);
    setLoadingAI(true);

    setTimeout(() => setResult("Analyzing prompt..."), 200);
    setTimeout(() => setResult("Simulating cinematic physics..."), 800);
    setTimeout(() => setResult("Rendering volumetric lighting..."), 1400);
    setTimeout(() => setResult("Finalizing output..."), 2000);
  };

  //////////////////////////////////////////////////
  // 🌈 BACKGROUND ANIMATION LOOP
  //////////////////////////////////////////////////
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;

    const draw = () => {
      frame++;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 60; i++) {
        const x = Math.sin(frame * 0.01 + i) * 200 + canvas.width / 2;
        const y = Math.cos(frame * 0.01 + i) * 200 + canvas.height / 2;

        ctx.fillStyle = "rgba(0,255,255,0.05)";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    };

    draw();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">

      {/* 🌌 CANVAS BACKGROUND (NEW) */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 opacity-40"
      />

      {/* 🌌 GRADIENT DEPTH */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{
          transform: `translate(${cursor.x}px, ${cursor.y}px)`,
          background:
            "radial-gradient(circle at top, rgba(0,255,255,0.2), transparent 40%), radial-gradient(circle at bottom, rgba(168,85,247,0.2), transparent 45%)",
        }}
      />

      {/* 🎥 VIDEO BACKDROP */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 h-full w-full object-cover opacity-20"
      >
        <source src="/demo.mp4" />
      </video>

      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />

      {/* NAV */}
      <header className="relative z-50 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-5">
          <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            AMKAAI
          </h1>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pt-28 text-center">

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="mb-6 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-5 py-2 text-cyan-300"
        >
          ✦ AI Cinematic Engine
        </motion.div>

        <h1 className="text-6xl font-black">
          Cinematic AI Video Studio
        </h1>

        <p className="mt-5 text-gray-400 max-w-xl">
          Generate Hollywood-level AI videos instantly
        </p>

        <div className="mt-10 flex gap-4">
          <button className="rounded-2xl bg-white px-8 py-4 text-black font-bold">
            Start Free
          </button>

          <button
            onClick={() => goToCheckout("pro")}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 px-8 py-4 font-bold"
          >
            Upgrade Pro
          </button>
        </div>
      </section>

      {/* 🎬 CINEMATIC STAGE */}
      <section className="relative z-10 mx-auto mt-24 max-w-6xl px-6">
        <motion.div
          animate={{ rotateX: cursor.y, rotateY: cursor.x }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10"
        >
          <video
            src={scenes[scene]}
            autoPlay
            muted
            loop
            className="h-[420px] w-full object-cover opacity-80"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent" />

          <div className="absolute bottom-5 left-5 text-cyan-300">
            Live AI Render Engine
          </div>

          <button
            onClick={() => setScene((s) => (s + 1) % scenes.length)}
            className="absolute bottom-5 right-5 bg-cyan-500 text-black px-4 py-2 rounded-xl"
          >
            Next Scene
          </button>
        </motion.div>
      </section>

      {/* ⚡ AI STUDIO */}
      <section className="relative z-10 mx-auto mt-32 max-w-4xl px-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">

          <h2 className="text-xl font-bold mb-4">
            AI Prompt Studio
          </h2>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="h-32 w-full rounded-xl bg-black/40 p-4"
          />

          <button
            onClick={generateAI}
            className="mt-4 bg-cyan-500 text-black px-6 py-3 rounded-xl"
          >
            Generate
          </button>

          <div className="mt-6 min-h-[120px] text-gray-300">
            {loadingAI ? "Processing cinematic pipeline..." : result}
          </div>
        </div>
      </section>
    </main>
  );
}