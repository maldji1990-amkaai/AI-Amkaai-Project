"use client";

import Link from "next/link";
import Image from "next/image"; 
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { useAuth } from "@clerk/nextjs";   
import {
  Sparkles, Video, BarChart3, ArrowRight, Play, ShieldCheck,
  Flame, Users, HelpCircle, ChevronDown, CheckCircle2, 
  Wand2, Move, AudioLines, Compass, Tv, RefreshCw, UserSquare2, LayoutDashboard, Settings, Mic
} from "lucide-react";

/* ================= TYPES ================= */
type PlanType = "trial" | "quarterly" | "biannually";
type MediaType = "video" | "avatar" | "voice"; 
type AspectRatioType = "16:9" | "9:16" | "1:1";
type CameraMoveType = "zoom-in" | "pan-left" | "orbit-360" | "tilt-up";

interface FeatureProps { icon: React.ReactNode; title: string; text: string; }
interface PricingCardProps {
  title: string; price: string; cycle: string; description: string; features: string[];
  buttonText: string; highlighted?: boolean; badgeText?: string; onClick: () => void;
}

/* ================= CONSTANTS & STATIC DATA ================= */
const PRESET_SUGGESTIONS = [
  { label: "🎬 Cinematic Studio", text: "cinematic corporate presentation speaker, photorealistic avatar, studio 8k lighting" },
  { label: "🌌 Futuristic Presenter", text: "cyberpunk news room anchor, professional avatar broadcasting, hyper-detailed" },
  { label: "🧸 Explainer Video", text: "3d animated tutor style avatar, vibrant workspace atmosphere, highly expressive" },
];

const AI_GALLERY = [
  { id: 1, type: "video", url: "/gallery/ai-image-1.png", prompt: "AI Avatar explaining cryptocurrency concepts with smooth hand gestures, business suit.", label: "Crypto Avatar V1" },
  { id: 2, type: "video", url: "/gallery/ai-image-2.png", prompt: "E-learning tutor digital human presenting mathematical models interactively.", label: "EduPresenter Core" },
  { id: 3, type: "video", url: "/gallery/ai-image-3.png", prompt: "Cinematic marketing avatar discussing high-tech electric sports cars in a clean studio backdrop.", label: "Promo Human Matrix" },
  { id: 4, type: "video", url: "/gallery/ai-image-4.png", prompt: "Multilingual AI support agent avatar delivering a corporate onboarding greeting message.", label: "Support Node Bot" }
];

/* ================= MAIN PAGE ================= */ 
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default function HomePage() {
  const { isSignedIn } = useAuth(); 
  const router = useRouter();       

  const [visitors, setVisitors] = useState(1482);
  const [online, setOnline] = useState(34);
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [hoveredGalleryId, setHoveredGalleryId] = useState<number | null>(null);
  
  // STUDIO ENGINE STATES
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [type, setType] = useState<MediaType>("video"); 
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>("16:9");
  const [creativity, setCreativity] = useState<number>(0.75);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // EXTRA STATES
  const [cameraMove, setCameraMove] = useState<CameraMoveType>("zoom-in");
  const [motionBrushActive, setMotionBrushActive] = useState(false);
  const [faceLockStrength, setFaceLockStrength] = useState(0.90);
  const [generateSoundFx, setGenerateSoundFx] = useState(true);

  // LIVE STATS TICKER
  useEffect(() => {
    const interval = setInterval(() => {
      setVisitors((v) => v + Math.floor(Math.random() * 2));
      setOnline(25 + Math.floor(Math.random() * 15));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // CURSOR GLOW EFFECT
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const glow = document.getElementById("cursor-glow");
      if (glow) {
        glow.style.left = `${e.clientX}px`;
        glow.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const goToCheckout = async (plan: PlanType) => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/pricing`);
      return;
    }

    try {
      setLoadingPlan(plan);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!data?.url) { alert("Checkout failed"); return; }
      window.location.href = data.url;
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const generateAI = async () => {
    if (!prompt.trim()) return;

    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/#studio");
      return;
    }

    try {
      setLoadingAI(true);
      setResult("");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type, aspectRatio, creativity, cameraMove, faceLockStrength, generateSoundFx, demo: true }),
      });
      const data = await res.json();
      setResult(data.output || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  const studioTabs = [
    { id: "video" as MediaType, title: "AI Video", subtitle: "توليد فيديو ذكي", icon: Video, color: "text-blue-400", bgGlow: "from-blue-500/20", placeholder: "صف موضوع أو مشهد الفيديو السينمائي الذي ترغب في توليده بالتفصيل بواسطة الذكاء الاصطناعي..." },
    { id: "avatar" as MediaType, title: "AI Avatar", subtitle: "شخصية رقمية متحدثة", icon: UserSquare2, color: "text-cyan-400", bgGlow: "from-cyan-500/20", placeholder: "اكتب النص أو السيناريو الكامل الذي ترغب من الشخصية الرقمية (الأفاتار) التحدث به ومحاكاته أمام الكاميرا..." },
    { id: "voice" as MediaType, title: "AI Voice Cloning & Lip-Sync", subtitle: "استنساخ ومزامنة الصوت حركياً", icon: Mic, color: "text-amber-400", bgGlow: "from-amber-500/20", placeholder: "اكتب هنا النص المراد تحويله لبصمتك الصوتية المستنسخة أو الصوت الجاهز مع ميزة تركيب وحركة الشفايف الاحترافية..." },
  ];

  const currentTabInfo = studioTabs.find(t => t.id === type)!;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030303] text-white font-sans selection:bg-cyan-500/30">
      
      {/* 🌌 BACKGROUND MATRIX GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#141416_1px,transparent_1px),linear-gradient(to_bottom,#141416_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.15),transparent_50%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.05),transparent_60%)]" />

      {/* 🌈 TRACKING CURSOR GLOW */}
      <div id="cursor-glow" className="pointer-events-none fixed z-0 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-500/5 to-indigo-500/5 blur-[120px] hidden md:block animate-pulse" />

      {/* GLOBAL HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#030303]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              <Sparkles className="text-cyan-400 animate-pulse" size={20} />
              AMKAAI
            </Link>
          </motion.div>

          <nav className="hidden items-center gap-8 text-xs font-bold uppercase tracking-wider text-gray-400 md:flex">
            <Link href="#studio" className="transition hover:text-white">Studio Console</Link>
            <Link href="#showcase" className="transition hover:text-white">Holographic Grid</Link>
            <Link href="#features" className="transition hover:text-white">Nodes</Link>
            <Link href="#pricing" className="transition hover:text-white">Pricing Plans</Link>
          </nav>

          <div className="flex items-center gap-3">
            {!isSignedIn && (
              <Link href="/sign-in" className="rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-xs font-bold text-gray-300 transition hover:bg-white/10 flex uppercase tracking-wider">
                Login
              </Link>
            )}
            
            <Link href={isSignedIn ? "/dashboard" : "/sign-up"} className="group flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-2 text-xs font-black text-black transition hover:opacity-95 shadow-[0_0_25px_rgba(6,182,212,0.25)] uppercase tracking-wider">
              {isSignedIn ? "Console" : "Get Started Free"} <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pb-16 pt-28 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-bold text-cyan-300 tracking-wide uppercase backdrop-blur-md">
          <Flame size={12} className="text-orange-400 animate-pulse" />
          AMKAAI Quantum Physics Engine Live
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-5xl text-5xl font-black tracking-tight leading-[1.05] md:text-7xl">
          The World’s Most Powerful <br />
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">AI Cinematic Orchestration Engine</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-6 max-w-3xl text-sm md:text-base text-gray-400 leading-relaxed font-light">
          Unlock uncompressed latent diffusion chains, multi-layered fluid mechanics, persistent face-lock geometry, and automated AI acoustics inside a single timeline terminal.
        </motion.p>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-[11px] font-mono text-gray-500">
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl"><Users size={12} className="text-cyan-400" /> {visitors} Industrial Creators Active</div>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {online} Cluster Rendering Nodes</div>
        </div>
      </section>

      {/* 🎛️ STUDIO CONTROL TOWER */}
      <section id="studio" className="relative z-10 mx-auto max-w-7xl px-6 pb-32">
        <div className="w-full rounded-3xl border border-white/10 bg-[#09090d] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[580px]">
          
          {/* SIDEBAR NAVIGATION */}
          <div className="w-full md:w-72 bg-[#0d0d14] border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2 pb-3 border-b border-white/5">
                <LayoutDashboard size={14} className="text-cyan-400" />
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Creation Studio</span>
              </div>
              
              <div className="space-y-1">
                {studioTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isSelected = type === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => { setType(tab.id); setResult(""); }}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition duration-200 group text-left ${
                        isSelected 
                          ? "bg-white/5 border border-white/10 text-white font-bold shadow-inner" 
                          : "text-gray-400 hover:bg-white/[0.02] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                          isSelected ? `bg-gradient-to-tr ${tab.bgGlow} text-white` : "bg-zinc-900 text-gray-500 group-hover:text-gray-300"
                        }`}>
                          <TabIcon size={14} className={isSelected ? tab.color : ""} />
                        </div>
                        <div className="flex flex-col max-w-[150px]">
                          <span className="text-xs font-bold truncate leading-tight">{tab.title}</span>
                          <span className="text-[10px] text-gray-500 font-medium truncate mt-0.5">{tab.subtitle}</span>
                        </div>
                      </div>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 md:mt-0 bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 space-y-2">
              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>Generation Power</span>
                <span className="text-cyan-400 font-bold">140 / 300 Credits</span>
              </div>
              <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500" style={{ width: "46%" }} />
              </div>
            </div>
          </div>

          {/* WORKSPACE AREA */}
          <div className="flex-1 p-6 flex flex-col justify-between space-y-6 bg-gradient-to-b from-transparent to-black/30">
            
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                    <span>Generate Creative {currentTabInfo.title}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">أنشئ محتواك المرئي، الأفاتار الرقمي فائق الواقعية، أو البصمات الصوتية مباشرة للإنتاج البصري والسمعي.</p>
                </div>
                <span className="self-start sm:self-center text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded-md font-mono font-bold tracking-wide uppercase">
                  Studio Pipeline Active
                </span>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={currentTabInfo.placeholder}
                    className="h-28 w-full rounded-2xl border border-white/5 bg-black/40 p-4 text-xs text-white outline-none placeholder:text-zinc-600 transition focus:border-cyan-500/30 resize-none font-mono leading-relaxed"
                  />
                  <button
                    onClick={generateAI}
                    disabled={loadingAI || !prompt.trim()}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-[10px] font-black text-black transition disabled:opacity-20 shadow-md uppercase tracking-wider"
                  >
                    {loadingAI ? "Rendering Stream..." : "Execute Studio Render ✨"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SUGGESTIONS.map((chip, idx) => (
                      <button key={idx} onClick={() => setPrompt(chip.text)} className="text-[9px] bg-white/5 border border-white/5 hover:border-white/10 px-2.5 py-1 rounded-lg text-gray-400 transition hover:text-white font-medium">
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  {type === "video" && (
                    <button onClick={() => setMotionBrushActive(!motionBrushActive)} className={`text-[9px] flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition ${motionBrushActive ? "bg-amber-500 border-amber-400 text-black shadow-md" : "bg-white/5 border-white/5 text-gray-400"}`}>
                      <Move size={10} /> Motion Brush {motionBrushActive ? "ON" : "OFF"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                
                <div className="bg-zinc-900/60 border border-white/5 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5">
                    {type === "video" ? <Compass size={12} className="text-indigo-400" /> : <Settings size={12} className="text-indigo-400" />}
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      {type === "video" ? "Cinematic Camera Rig" : type === "avatar" ? "Avatar Lip-Sync Pass" : "Voice Matrix Target"}
                    </label>
                  </div>
                  <select value={cameraMove} onChange={(e) => setCameraMove(e.target.value as CameraMoveType)} className="w-full bg-[#0d0d14] text-[11px] text-gray-300 border border-white/5 p-2 rounded-lg focus:outline-none focus:border-cyan-500/40">
                    {type === "video" ? (
                      <>
                        <option value="zoom-in">🔭 3D Zoom In</option>
                        <option value="pan-left">↔️ Pan Left/Right</option>
                        <option value="orbit-360">🔄 Orbit 360°</option>
                        <option value="tilt-up">↕️ Tilt Cinematic</option>
                      </>
                    ) : type === "avatar" ? (
                      <>
                        <option value="zoom-in">🎙️ Ultra-Precise Arabic/English Sync</option>
                        <option value="pan-left">🎭 Dynamic Facial Expression Match</option>
                      </>
                    ) : (
                      <>
                        <option value="zoom-in">🇸🇦 العربية الفصحى الفخمة</option>
                        <option value="pan-left">🇺🇸 English US Standard</option>
                        <option value="orbit-360">🇫🇷 French Global Core</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="bg-zinc-900/60 border border-white/5 p-3.5 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400 text-xs">👤</span>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        {type === "voice" ? "Cloning Engine Accuracy" : "Persistent Face Lock"}
                      </label>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">{Math.round(faceLockStrength * 100)}%</span>
                  </div>
                  <input type="range" min="0.5" max="1" step="0.05" value={faceLockStrength} onChange={(e) => setFaceLockStrength(parseFloat(e.target.value))} className="w-full accent-emerald-500 bg-white/5 h-1 rounded-lg cursor-pointer" />
                </div>

                <div className="bg-zinc-900/60 border border-white/5 p-3.5 rounded-xl space-y-2">
                  <label className="text-[10px] font-black text-gray-400 block mb-2 uppercase tracking-wider">Aspect Architecture</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["16:9", "9:16", "1:1"] as AspectRatioType[]).map((ratio) => (
                      <button key={ratio} type="button" onClick={() => setAspectRatio(ratio)} className={`py-1.5 text-[10px] rounded-lg border transition font-mono ${aspectRatio === ratio ? "border-cyan-500 text-cyan-400 bg-cyan-500/10 font-bold" : "bg-[#0d0d14] border-white/5 text-gray-500 hover:text-gray-300"}`}>
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            <div className="relative min-h-[250px] rounded-2xl border border-white/5 bg-[#030305] flex flex-col items-center justify-center p-4 overflow-hidden shadow-inner">
              <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[9px] uppercase font-mono tracking-widest text-gray-500 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                <Tv size={11} className="text-cyan-400" /> Frame Node Buffer
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button type="button" onClick={() => setGenerateSoundFx(!generateSoundFx)} className={`text-[8px] font-mono px-2 py-0.5 rounded border uppercase transition ${generateSoundFx ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-transparent border-white/5 text-gray-600"}`}>
                  {generateSoundFx ? "🔊 AI Audio Stream Connected" : "🔇 Muted Stream"}
                </button>
              </div>

              {!result && !loadingAI && (
                <div className="text-center space-y-1">
                  <Play size={20} className="mx-auto text-zinc-800 mb-1" />
                  <p className="text-[11px] text-zinc-600 font-mono">Cluster pipeline standing by for video stream allocation.</p>
                </div>
              )}

              {loadingAI && (
                <div className="text-center space-y-2">
                  <RefreshCw size={20} className="animate-spin text-cyan-400 mx-auto" />
                  <p className="text-[10px] text-cyan-400 font-mono tracking-wider animate-pulse">Processing Neural Frame Sequences...</p>
                </div>
              )}

              {result && !loadingAI && (
                <div className="w-full h-full flex items-center justify-center max-h-[220px]">
                  {type === "voice" ? (
                    <audio src={result} controls className="w-[80%] accent-amber-400" />
                  ) : (
                    <video src={result} controls autoPlay loop className="rounded-xl max-h-[190px] w-full object-contain" />
                  )}
                </div>
              )}

              <div className="absolute bottom-2 inset-x-2 bg-black/80 border border-white/5 rounded-xl p-2 flex items-center gap-3 backdrop-blur-md">
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded text-[8px] uppercase tracking-wider font-mono font-bold text-gray-400">
                  <AudioLines size={10} className="text-cyan-400 animate-pulse" /> Timeline.01
                </div>
                <div className="flex-1 flex gap-0.5 items-center justify-center h-4 opacity-40">
                  {[3,5,2,6,7,4,3,5,8,9,3,4,6,2,4,7,8,4,3,6,7,3,2,6,8,5,3].map((h, i) => (
                    <div key={i} className="bg-gradient-to-t from-cyan-500 to-indigo-500 w-full rounded-sm" style={{ height: `${h * 10}%` }} />
                  ))}
                </div>
                <span className="text-[8px] font-mono text-zinc-600">04.0s SEC</span>
              </div>
            </div>

          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-mono text-zinc-600">
          <ShieldCheck size={12} className="text-cyan-500/60" /> Secure payment gateways layered via Lemon Squeezy Merchant Global Node.
        </div>
      </section>

      {/* HOLOGRAPHIC AI SHOWCASE GRID */}
      <section id="showcase" className="relative z-10 mx-auto max-w-7xl px-6 pb-32">
        <div className="flex flex-col items-center justify-center mb-12 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[10px] uppercase font-black text-cyan-400 tracking-widest mb-3">
            <Wand2 size={12} /> Neural Grid Output
          </div>
          <h2 className="text-3xl font-black tracking-tight">Recent Live AI Renders</h2>
          <p className="text-gray-500 text-xs mt-2 max-w-md">Hover over cards to read the prompt sequence executed by our node cluster.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {AI_GALLERY.map((item) => (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredGalleryId(item.id)}
              onMouseLeave={() => setHoveredGalleryId(null)}
              className="relative group rounded-2xl overflow-hidden border border-white/5 bg-zinc-950 aspect-[3/4] cursor-pointer shadow-2xl"
            >
              <div className="relative w-full h-full">
                <Image 
                  src={item.url} 
                  alt={item.label}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-100"
                />
              </div>

              <div className="absolute top-4 left-4 z-20">
                <span className="px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 border border-white/5">
                  <Video size={10} className="text-cyan-400" />
                  {item.type}
                </span>
              </div>

              <motion.div 
                animate={{ 
                  opacity: hoveredGalleryId === item.id ? 1 : 0, 
                  y: hoveredGalleryId === item.id ? 0 : 15 
                }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-transparent p-5 flex flex-col justify-end text-left z-10 pointer-events-none"
              >
                <p className="text-cyan-400 text-[9px] font-black uppercase tracking-wider mb-1 font-mono">Prompt Sequence</p>
                <p className="text-[11px] text-gray-300 font-light line-clamp-4 mb-4 leading-relaxed italic">
                  "{item.prompt}"
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-xs font-bold text-white">{item.label}</span>
                  <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> VERIFIED
                  </span>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES HUB */}
      <section id="features" className="relative z-10 mx-auto grid max-w-7xl gap-6 px-6 pb-32 md:grid-cols-4">
        <Feature icon={<Sparkles size={16} />} title="Spatial 3D Tracking" text="Synthesis framework configured to build immaculate depths and highly clean avatar surfaces." />
        <Feature icon={<Video size={16} />} title="Fluid Video Mechanics" text="Enforces spatial real-world consistency rules across every single generated frame block." />
        <Feature icon={<UserSquare2 size={16} />} title="AI Digital Humans" text="Bespoke hyper-realistic avatars with absolute accurate lip-synchronization engines." />
        <Feature icon={<BarChart3 size={16} />} title="Telemetry Console" text="Tracks compute units, active nodes, history chains, and model iteration sequences live." />
      </section>

      {/* PRICING PLANS */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
        <div className="mb-14 text-center">
          <h2 className="text-xs font-black tracking-[0.2em] text-cyan-400 uppercase mb-2">Computational Costing</h2>
          <p className="text-3xl font-black tracking-tight">Flexible Studio Scaler Plans</p>
        </div>

        {/* 🌟 التحديث هنا: تم تعديل الـ Grid لتستوعب 3 خطط بدلاً من خطتين */}
<div className="grid gap-8 md:grid-cols-3">
  <PricingCard
    title="3-Day Full Access Trial"
    price="$1.99"
    cycle="first 3 days, then $17.99/mo"
    description="Entry level tier for content creators and casual experimenters."
    features={["30 Credits", "720p HD Access", "Priority Support"]}
    buttonText={loadingPlan === "trial" ? "Routing..." : "Get Trial Access"}
    onClick={() => goToCheckout("trial")}
  />

  <PricingCard
    title="Amkaai Pro Plan"
    price="$14.99"
    cycle="per month ($44.97 billed quarterly)"
    description="Engineered for independent design practitioners."
    badgeText="MOST POPULAR"
    features={["600 Credits /mo", "Standard Pipeline", "HD File Downloads"]}
    buttonText={loadingPlan === "quarterly" ? "Routing..." : "Get Pro Plan"}
    onClick={() => goToCheckout("quarterly")}
    highlighted
  />

  <PricingCard
    title="Studio Ultra 1080p"
    price="$12.99"
    cycle="per month ($77.94 billed every 6 months)"
    description="Tailored specifically for production agencies."
    features={["Uncapped Rendering", "4K Neural Network Upscaling", "Commercial Use"]}
    buttonText={loadingPlan === "biannually" ? "Routing..." : "Get Ultra Plan"}
    onClick={() => goToCheckout("biannually")}
  />
</div>
      </section>

      {/* INTERACTIVE FAQ */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-32">
        <div className="mb-12 text-center">
          <HelpCircle size={22} className="mx-auto text-cyan-400 mb-2" />
          <p className="text-xl font-extrabold tracking-tight">System FAQ Knowledge Base</p>
        </div>
        <div className="space-y-3">
          {[
            { q: "How do compute node credits calculate allocations?", a: "Every second of generated video consumes roughly 5 node units. Avatar lip-sync layers consume 3 units per generation pass." },
            { q: "Can I cancel my commercial use license contract anytime?", a: "Yes. All licenses are managed dynamically. Once cancelled, your assets remain safe under your folder directory." },
            { q: "What underlying models operate AMKAAI core pipelines?", a: "We run a bespoke proprietary optimization layer constructed directly above Kling-v2 and specialized custom weights." }
          ].map((faq, i) => (
            <div key={i} className="border border-white/5 bg-[#09090b]/60 rounded-xl overflow-hidden transition-all">
              <button onClick={() => setActiveFaq(activeFaq === i ? null : i)} className="w-full p-4 flex items-center justify-between text-left text-xs font-bold font-mono text-gray-300 hover:text-white">
                <span>{faq.q}</span>
                <ChevronDown size={14} className={`transform transition-transform text-gray-500 ${activeFaq === i ? "rotate-180 text-cyan-400" : ""}`} />
              </button>
              <AnimatePresence>
                {activeFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 bg-black/30">
                    <p className="p-4 text-xs text-gray-400 font-light leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ================= HELPERS / MINI COMPONENTS ================= */
function Feature({ icon, title, text }: FeatureProps) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-2xl border border-white/5 bg-[#070709]/50 p-5 backdrop-blur-xl transition-all">
      <div className="mb-4 text-cyan-400 bg-cyan-500/10 w-9 h-9 rounded-xl flex items-center justify-center border border-cyan-500/10">{icon}</div>
      <h3 className="text-sm font-bold tracking-wide text-gray-200">{title}</h3>
      <p className="mt-2 text-[11px] text-gray-500 leading-relaxed font-light">{text}</p>
    </motion.div>
  );
}

function PricingCard({ title, price, cycle, description, features, buttonText, highlighted = false, badgeText, onClick }: PricingCardProps) {
  return (
    <motion.div whileHover={{ y: -2 }} className={`relative overflow-hidden rounded-2xl border p-7 backdrop-blur-2xl flex flex-col justify-between ${highlighted ? "border-cyan-500/20 bg-gradient-to-b from-cyan-950/10 via-black to-black shadow-2xl" : "border-white/5 bg-[#070709]"}`}>
      {badgeText && (
        <div className="absolute right-4 top-4 rounded-full bg-cyan-400 px-2.5 py-0.5 text-[8px] font-black text-black tracking-widest uppercase">
          {badgeText}
        </div>
      )}
      <div>
        <h3 className="text-[10px] font-black tracking-[0.15em] text-cyan-400 uppercase font-mono">{title}</h3>
        <div className="mt-3">
            <span className="text-4xl font-black tracking-tight">{price}</span>
            <p className="text-[10px] text-gray-500 font-mono mt-1">{cycle}</p>
        </div>
        <p className="mt-4 text-[11px] text-gray-400 font-light leading-relaxed">{description}</p>

        <div className="mt-6 space-y-2.5 border-t border-white/5 pt-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-[11px] text-gray-300 font-light">
              <CheckCircle2 size={12} className="text-cyan-400 shrink-0" />
              {feature}
            </div>
          ))}
        </div>
      </div>
      <button onClick={onClick} className={`mt-8 w-full rounded-xl py-3 text-[11px] font-black uppercase tracking-wider transition ${highlighted ? "bg-cyan-500 text-black hover:opacity-90 shadow-lg shadow-cyan-500/10" : "bg-white/5 text-white border border-white/10 hover:bg-white/10"}`}>
        {buttonText}
      </button>
    </motion.div>
  );
}