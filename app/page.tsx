 "use client";

import Link from "next/link";
import Image from "next/image"; 
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { useAuth, useClerk } from "@clerk/nextjs";   
import {
  Sparkles, Video, BarChart3, ArrowRight, Play, ShieldCheck,
  Flame, Users, HelpCircle, ChevronDown, CheckCircle2, 
  Wand2, Move, AudioLines, Compass, Tv, RefreshCw, UserSquare2, LayoutDashboard, Settings, Mic, Plus,
  ImageIcon, Send, Download, PanelLeft, Layers3, SlidersHorizontal, Bot, User as UserIcon, Columns,
  Share2, Subtitles, FileText, Clock, Palette, BookTemplate, TrendingUp, Copy, Check
} from "lucide-react";

/* ================= TYPES ================= */
type PlanType = "trial" | "quarterly" | "biannually";
type MediaType = "video" | "avatar" | "voice"; 
type AspectRatioType = "16:9" | "9:16" | "1:1";
type CameraMoveType = "zoom-in" | "pan-left" | "orbit-360" | "tilt-up";
type DashMediaType = "ai-video" | "ai-avatar" | "image-to-avatar" | "voice-clone";

const PRESET_STYLES = [
  { id: "cyberpunk", name: "Cyberpunk neon", suffix: ", cyberpunk neon style, blade runner aesthetics, high contrast, 8k" },
  { id: "pixar", name: "3D Pixar Animation", suffix: ", 3d animation style, pixar character design, vibrant colors, raytracing" },
  { id: "film", name: "Vintage 70s Film", suffix: ", 1970s cinematic film stock, grain, warm volumetric light, anamorphic lens" },
  { id: "anime", name: "Anime Ghibli", suffix: ", anime masterwork style, studio ghibli aesthetic, hand-drawn textures" },
];

const TEMPLATES = [
  { id: "news", icon: "📰", name: "News Anchor", prompt: "Professional AI news anchor presenting breaking news in a modern broadcast studio, dynamic lighting, 4K cinematic." },
  { id: "product", icon: "🛍️", name: "Product Ad", prompt: "Cinematic product advertisement video, luxury brand presentation, dramatic lighting, slow motion reveal, photorealistic 8K." },
  { id: "tutorial", icon: "🎓", name: "Tutorial", prompt: "Engaging educational presenter explaining complex concepts with dynamic graphics and animations in a clean modern studio." },
  { id: "social", icon: "📱", name: "Social Reel", prompt: "Viral social media reel, trendy transitions, vibrant colors, energetic music sync, 9:16 vertical format for TikTok/Reels." },
  { id: "promo", icon: "🚀", name: "Startup Pitch", prompt: "High-energy startup pitch video with CEO avatar, dynamic data visualization overlays, corporate cinematic style." },
  { id: "arabic", icon: "🇸🇦", name: "Arabic Presenter", prompt: "Professional Arabic-speaking AI avatar presenter in elegant attire, clean studio backdrop, natural lip-sync, ultra-realistic." },
];

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
export default function HomePage() {
  const { isSignedIn } = useAuth(); 
  const { signOut } = useClerk();
  const router = useRouter();       

  const [visitors, setVisitors] = useState(1482);
  const [online, setOnline] = useState(34);
  const [liveCount, setLiveCount] = useState(3241);
  const [duration, setDuration] = useState<5 | 10 | 30 | 60>(10);
  const [watermarkOff, setWatermarkOff] = useState(false);
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
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [platformModalOpen, setPlatformModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("trial");

  // EXTRA STATES
  const [cameraMove, setCameraMove] = useState<CameraMoveType>("zoom-in");
  const [motionBrushActive, setMotionBrushActive] = useState(false);
  const [faceLockStrength, setFaceLockStrength] = useState(0.90);
  const [generateSoundFx, setGenerateSoundFx] = useState(true);

  // DASHBOARD STUDIO STATES
  const [dashInput, setDashInput] = useState("");
  const [dashLoading, setDashLoading] = useState(false);
  const [dashResult, setDashResult] = useState("");
  const [dashType, setDashType] = useState<DashMediaType>("ai-video");
  const [dashAspect, setDashAspect] = useState<AspectRatioType>("16:9");
  const [dashCamera, setDashCamera] = useState("static");
  const [renderQueue, setRenderQueue] = useState<{id:string;prompt:string;progress:number}[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [credits, setCredits] = useState(0);

  // STUDIO VISIBILITY — لا يظهر إلا بعد الضغط على أحد الأزرار الأربعة
  const [studioVisible, setStudioVisible] = useState(false);
  const [activeStudioTool, setActiveStudioTool] = useState<DashMediaType | null>(null);

  const openStudio = (tool: DashMediaType) => {
    setActiveStudioTool(tool);
    setDashType(tool);
    setStudioVisible(true);
    setDashInput("");
    setDashResult("");
    setTimeout(() => {
      document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // NEW FEATURE STATES
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [scriptMode, setScriptMode] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [styleTransferImg, setStyleTransferImg] = useState<string | null>(null);
  const [renderETA, setRenderETA] = useState<number | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videosGenerated, setVideosGenerated] = useState(12847);
  useEffect(() => { setVideosGenerated(12847 + Math.floor(Math.random() * 200)); }, []);
  const [locale, setLocale] = useState<'ar' | 'en'>('en');

  // DETECT LOCALE BY BROWSER LANGUAGE (no CORS issues)
  useEffect(() => {
    const lang = navigator.language || '';
    const arabicLangs = ['ar', 'ar-DZ', 'ar-SA', 'ar-EG', 'ar-MA', 'ar-TN', 'ar-IQ', 'ar-AE'];
    if (arabicLangs.some(l => lang.startsWith(l)) || lang.startsWith('ar')) {
      setLocale('ar');
    }
  }, []);

  // LIVE COUNT — يتغير كل ثانية
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCount(v => v + Math.floor(Math.random() * 3) - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // PROMPT QUALITY
  const promptQuality = (() => {
    const len = dashInput.trim().length;
    if (len === 0) return null;
    if (len < 30) return "poor" as const;
    if (len < 80) return "good" as const;
    return "excellent" as const;
  })();

  // LIVE STATS TICKER
  useEffect(() => {
    const interval = setInterval(() => {
      setVisitors((v) => v + Math.floor(Math.random() * 2));
      setOnline(25 + Math.floor(Math.random() * 15));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // FETCH REAL CREDITS FROM API
  useEffect(() => {
    if (!isSignedIn) return;
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/credits");
        if (!res.ok) return;
        const data = await res.json();
        if (data?.credits !== undefined) setCredits(data.credits);
        else if (data?.remainingCredits !== undefined) setCredits(data.remainingCredits);
      } catch (e) {
        console.error("Credits fetch failed:", e);
      }
    };
    fetchCredits();
  }, [isSignedIn]);

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

  const executeDash = async () => {
    if (!dashInput.trim()) return;
    if (!isSignedIn) { router.push("/sign-in?redirect_url=/#studio"); return; }
    
    // 🔒 فحص الرصيد — إذا انتهى يفتح modal الاشتراك
    if (credits <= 0) {
      setPricingModalOpen(true);
      return;
    }

    const jobId = crypto.randomUUID();
    setRenderQueue(prev => [{ id: jobId, prompt: dashInput.slice(0, 28) + "...", progress: 10 }, ...prev]);
    setDashLoading(true); setDashResult("");

    // ETA countdown
    const etaSeconds = dashType === "ai-video" ? 45 : dashType === "ai-avatar" ? 30 : dashType === "voice-clone" ? 20 : 35;
    setRenderETA(etaSeconds);
    const etaInterval = setInterval(() => {
      setRenderETA(prev => {
        if (prev === null || prev <= 1) { clearInterval(etaInterval); return null; }
        return prev - 1;
      });
    }, 1000);
    try {
      let endpoint = "/api/generate-video";
      if (dashType === "ai-avatar") endpoint = "/api/generate-avatar";
      if (dashType === "image-to-avatar") endpoint = "/api/generate-image";
      if (dashType === "voice-clone") endpoint = "/api/generate-voice";
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: dashInput, aspectRatio: dashAspect, cameraMotion: dashCamera }),
      });

      // 402 = رصيد منتهي من السيرفر
      if (res.status === 402) {
        setCredits(0);
        setPricingModalOpen(true);
        setRenderQueue(prev => prev.filter(j => j.id !== jobId));
        return;
      }

      const data = await res.json();

      // رصيد منتهي من الـ response body
      if (data?.error?.toLowerCase().includes("credit") || data?.remainingCredits === 0) {
        setCredits(0);
        setPricingModalOpen(true);
        setRenderQueue(prev => prev.filter(j => j.id !== jobId));
        return;
      }

      setDashResult(data.videoUrl || data.outputUrl || "");
      if (data.remainingCredits !== undefined) setCredits(data.remainingCredits);
      setRenderQueue(prev => prev.map(j => j.id === jobId ? { ...j, progress: 100 } : j));
    } catch(e) { console.error(e); } finally { setDashLoading(false); }
  };

  const studioTabs = [
    { id: "video" as MediaType, title: "AI Video", subtitle: "توليد فيديو ذكي", icon: Video, color: "text-blue-400", bgGlow: "from-blue-500/20", placeholder: "صف موضوع أو مشهد الفيديو السينمائي الذي ترغب في توليده بالتفصيل بواسطة الذكاء الاصطناعي..." },
    { id: "avatar" as MediaType, title: "AI Avatar", subtitle: "شخصية رقمية متحدثة", icon: UserSquare2, color: "text-cyan-400", bgGlow: "from-cyan-500/20", placeholder: "اكتب النص أو السيناريو الكامل الذي ترغب من الشخصية الرقمية (الأفاتار) التحدث به ومحاكاته أمام الكاميرا..." },
    { id: "voice" as MediaType, title: "AI Voice Cloning & Lip-Sync", subtitle: "استنساخ ومزامنة الصوت حركياً", icon: Mic, color: "text-amber-400", bgGlow: "from-amber-500/20", placeholder: "اكتب هنا النص المراد تحويله لبصمتك الصوتية المستنسخة أو الصوت الجاهز مع ميزة تركيب وحركة الشفايف الاحترافية..." },
  ];

  const currentTabInfo = studioTabs.find(t => t.id === type)!;

  return (
    <main className="relative min-h-screen overflow-hidden text-white font-sans selection:bg-cyan-500/30">
      
      {/* 🎬 BACKGROUND VIDEO */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <source src="/demo/videos/demo.mp4" type="video/mp4" />
      </video>
      {/* overlay داكن */}
      <div className="fixed inset-0 bg-[#030303]/75 pointer-events-none" style={{ zIndex: 1 }} />
      {/* 🌌 BACKGROUND MATRIX GRID */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#141416_1px,transparent_1px),linear-gradient(to_bottom,#141416_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" style={{ zIndex: 2 }} />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.15),transparent_50%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.05),transparent_60%)] pointer-events-none" style={{ zIndex: 2 }} />

      {/* 🌈 TRACKING CURSOR GLOW */}
      <div id="cursor-glow" className="pointer-events-none fixed z-0 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-500/5 to-indigo-500/5 blur-[120px] hidden md:block animate-pulse" />

      {/* GLOBAL HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#030303]/80 backdrop-blur-xl">

        {/* ── شريط إعلاني أعلى الهيدر ── */}
        <div className="bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-cyan-500/10 border-b border-cyan-500/10 px-4 py-1.5 text-center">
          <p className="text-[11px] text-cyan-300 font-semibold">
            ✨ Introducing AMKAAI Avatar V2 — the most lifelike AI presenter ever made.{" "}
            <button onClick={() => setPricingModalOpen(true)} className="underline font-black hover:text-white transition">
              Try it free →
            </button>
          </p>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">

          {/* ── LOGO + NAV ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              <Sparkles className="text-cyan-400 animate-pulse" size={20} />
              AMKAAI
            </Link>
            <nav className="hidden items-center md:flex">
              {[
                { label: "Platform",   onClick: () => setPlatformModalOpen(true) },
                { label: "Developers", onClick: () => setDevModalOpen(true)      },
              ].map(item => (
                <button key={item.label} onClick={item.onClick}
                  className="px-3.5 py-2 text-[12px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition">
                  {item.label}
                </button>
              ))}
              <button onClick={() => setPricingModalOpen(true)}
                className="px-3.5 py-2 text-[12px] font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/5 rounded-xl transition">
                Upgrade ✦
              </button>
            </nav>
          </motion.div>

          {/* ── RIGHT ACTIONS ── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">

            {/* زر تغيير اللغة */}
            <div className="flex items-center rounded-xl border border-white/10 overflow-hidden bg-white/[0.03]">
              <button onClick={() => setLocale('en')}
                className={`px-3 py-1.5 text-[11px] font-black tracking-wider transition ${locale === 'en' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-white'}`}>
                EN
              </button>
              <button onClick={() => setLocale('ar')}
                className={`px-3 py-1.5 text-[11px] font-black tracking-wider transition ${locale === 'ar' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-white'}`}>
                AR
              </button>
            </div>

            {/* ── الحالة: غير مسجّل ── */}
            {!isSignedIn ? (
              <>
                {/* Sign In → صفحة تسجيل الدخول */}
                <Link href="/sign-in"
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-gray-300 border border-white/10 bg-white/[0.03] hover:bg-white/10 transition">
                  Sign In
                </Link>

                {/* Get Started for Free → صفحة إنشاء الحساب */}
                <Link href="/sign-up"
                  className="px-5 py-2 rounded-xl text-[12px] font-black text-black bg-gradient-to-r from-cyan-400 to-indigo-500 hover:opacity-90 transition shadow-[0_0_20px_rgba(6,182,212,0.25)] uppercase tracking-wide whitespace-nowrap">
                  Get Started for Free
                </Link>
              </>
            ) : (
              /* ── الحالة: مسجّل — dropdown للحساب ── */
              <div className="relative group">
                <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/8 px-3 py-1.5 transition">
                  {/* Credits badge */}
                  <span className={`flex items-center gap-1 text-[11px] font-bold ${credits === 0 ? "text-amber-400" : "text-cyan-400"}`}>
                    {credits === 0 ? "⚡ Upgrade" : `💎 ${credits}`}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-[11px] font-black text-black">
                    U
                  </div>
                  <ChevronDown size={12} className="text-gray-500 group-hover:text-gray-300 transition" />
                </button>

                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#0f0f17] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 overflow-hidden z-50">
                  {/* رصيد Credits */}
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wide mb-1">Balance</p>
                    {credits === 0 ? (
                      <div>
                        <p className="text-xs text-amber-400 font-bold mb-1.5">No credits yet</p>
                        <p className="text-[10px] text-gray-500 leading-snug mb-2.5">Subscribe to get credits and start generating.</p>
                        <button
                          onClick={() => setPricingModalOpen(true)}
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-black text-[11px] font-black hover:opacity-90 transition"
                        >✦ Get Credits — Subscribe</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-white">💎 {credits} credits</span>
                          <button onClick={() => setPricingModalOpen(true)}
                            className="text-[10px] font-bold text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded-lg hover:bg-cyan-500/20 transition">
                            Top Up
                          </button>
                        </div>
                        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100,(credits/300)*100)}%` }} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* روابط الحساب */}
                  <div className="py-1.5">
                    {[
                      { icon: "👤", label: "My Account",   href: "/dashboard" },
                      { icon: "🎬", label: "My Videos",    href: "/dashboard" },
                      { icon: "💎", label: "Upgrade Plan", href: "#", action: () => setPricingModalOpen(true) },
                      { icon: "⚙️", label: "Settings",     href: "/dashboard" },
                    ].map(item => (
                      item.action
                        ? <button key={item.label} onClick={item.action}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-gray-300 hover:text-white hover:bg-white/5 transition text-left">
                            <span>{item.icon}</span>{item.label}
                          </button>
                        : <Link key={item.label} href={item.href}
                            className="flex items-center gap-3 px-4 py-2.5 text-[12px] text-gray-300 hover:text-white hover:bg-white/5 transition">
                            <span>{item.icon}</span>{item.label}
                          </Link>
                    ))}
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-white/5 py-1.5">
                    <button
                      onClick={() => signOut({ redirectUrl: "/" })}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/5 transition text-left">
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
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
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
            <Users size={12} className="text-cyan-400" />
            <span className="text-white font-black">Join 1,000+ creators</span>
            <span className="text-gray-500">already generating</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-bold">Live GPU Rendering</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
            <ShieldCheck size={12} className="text-cyan-400" />
            <span className="text-gray-400">No watermark on Pro</span>
          </div>
        </div>

        {/* ── 4 TOOL BUTTONS ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-12 w-full max-w-4xl">
          <p className="text-[11px] font-mono text-gray-600 uppercase tracking-[0.2em] mb-5 text-center">Choose your creation tool</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* 1 — AI Video Generator */}
            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openStudio("ai-video")}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-500/10 to-transparent px-4 py-6 transition-all hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/25 transition">
                <Video size={22} className="text-purple-400" />
              </div>
              <div>
                <p className="text-[13px] font-black text-white leading-tight">AI Video</p>
                <p className="text-[13px] font-black text-white leading-tight">Generator</p>
                <p className="text-[10px] text-gray-500 mt-1 font-mono">Text → Cinematic Video</p>
              </div>
              <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-purple-400 opacity-0 group-hover:opacity-100 transition animate-pulse" />
            </motion.button>

            {/* 2 — Create an Avatar */}
            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openStudio("ai-avatar")}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-transparent px-4 py-6 transition-all hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/25 transition">
                <UserSquare2 size={22} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-[13px] font-black text-white leading-tight">Create an</p>
                <p className="text-[13px] font-black text-white leading-tight">Avatar</p>
                <p className="text-[10px] text-gray-500 mt-1 font-mono">AI Digital Presenter</p>
              </div>
              <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-0 group-hover:opacity-100 transition animate-pulse" />
            </motion.button>

            {/* 3 — Image to Video */}
            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openStudio("image-to-avatar")}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-transparent px-4 py-6 transition-all hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/25 transition">
                <ImageIcon size={22} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[13px] font-black text-white leading-tight">Image to</p>
                <p className="text-[13px] font-black text-white leading-tight">Video</p>
                <p className="text-[10px] text-gray-500 mt-1 font-mono">HeyGen Engine Mode</p>
              </div>
              <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-100 transition animate-pulse" />
            </motion.button>

            {/* 4 — AI Voice Cloning & Lip-Sync */}
            <motion.button
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openStudio("voice-clone")}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent px-4 py-6 transition-all hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/25 transition">
                <Mic size={22} className="text-amber-400" />
              </div>
              <div>
                <p className="text-[13px] font-black text-white leading-tight">AI Voice</p>
                <p className="text-[13px] font-black text-white leading-tight">Cloning & Lip-Sync</p>
                <p className="text-[10px] text-gray-500 mt-1 font-mono">Cloning Matrix</p>
              </div>
              <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-amber-400 opacity-0 group-hover:opacity-100 transition animate-pulse" />
            </motion.button>

          </div>

          {!isSignedIn && (
            <div className="mt-6 flex justify-center">
              <Link href="/sign-up" className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-3 text-sm font-bold text-gray-300 transition hover:bg-white/10 uppercase tracking-wider">
                Get Started Free
              </Link>
            </div>
          )}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════
          HOW IT WORKS — 3 STEPS
      ═══════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-[11px] font-mono text-cyan-500 uppercase tracking-[0.2em] mb-3">Simple Process</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">How It Works</h2>
          <p className="text-gray-500 text-sm mt-3 max-w-xl mx-auto">From prompt to cinematic video in under a minute — no editing skills needed.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* connector line */}
          <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-cyan-500/20 via-indigo-500/40 to-cyan-500/20" />
          {[
            { step: "01", icon: "✍️", title: "Describe Your Vision", desc: "Type a prompt in plain language. Be as detailed or as brief as you like — our AI understands context, style, and emotion.", color: "from-cyan-500/20 to-transparent", border: "border-cyan-500/20", badge: "text-cyan-400" },
            { step: "02", icon: "⚡", title: "AI Renders Instantly", desc: "Our GPU cluster processes your request in real-time — applying cinematic grading, face-lock, voice synthesis, and motion.", color: "from-indigo-500/20 to-transparent", border: "border-indigo-500/20", badge: "text-indigo-400" },
            { step: "03", icon: "🎬", title: "Download & Share", desc: "Export in HD, share directly to social media, or embed anywhere. No watermark on Pro plans.", color: "from-purple-500/20 to-transparent", border: "border-purple-500/20", badge: "text-purple-400" },
          ].map((s) => (
            <motion.div key={s.step} whileHover={{ y: -4 }} className={`relative rounded-2xl border ${s.border} bg-gradient-to-b ${s.color} p-7 backdrop-blur-md`}>
              <div className={`text-[11px] font-black font-mono ${s.badge} mb-4 tracking-widest`}>STEP {s.step}</div>
              <div className="text-3xl mb-4">{s.icon}</div>
              <h3 className="text-base font-black text-white mb-2">{s.title}</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          GALLERY — Real Examples
      ═══════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 pb-20">
        <div className="text-center mb-10">
          <p className="text-[11px] font-mono text-cyan-500 uppercase tracking-[0.2em] mb-3">Made with AMKAAI</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">Real Generations</h2>
          <p className="text-gray-500 text-sm mt-3">Examples created by our users — no post-editing.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {AI_GALLERY.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.03 }}
              onHoverStart={() => setHoveredGalleryId(item.id)}
              onHoverEnd={() => setHoveredGalleryId(null)}
              className="relative rounded-2xl overflow-hidden border border-white/5 aspect-video cursor-pointer group"
            >
              <img src={item.url} alt={item.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${hoveredGalleryId === item.id ? "opacity-100" : "opacity-0"}`}>
                <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-md">
                  <Play size={16} className="text-white ml-0.5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-[11px] font-black text-white truncate">{item.label}</p>
                <p className="text-[9px] text-gray-400 font-mono mt-0.5 truncate">{item.prompt.slice(0, 40)}...</p>
              </div>
              <div className="absolute top-2 right-2 text-[9px] bg-black/60 border border-white/10 px-2 py-0.5 rounded-full text-gray-400 font-mono backdrop-blur-sm">{item.type}</div>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-8">
          <button onClick={() => openStudio("ai-video")} className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-sm font-bold text-gray-300 hover:text-white transition">
            <Sparkles size={14} className="text-cyan-400" /> Create yours now
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          COMMUNITY — Discord + Affiliate
      ═══════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-10 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Discord */}
          <motion.div whileHover={{ y: -3 }} className="relative rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 to-violet-950/20 p-8 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl" />
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-black text-white mb-2">Join our Discord</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">Connect with 500+ creators. Share prompts, get feedback, and stay up to date with new features and model releases.</p>
            <div className="flex items-center gap-3 mb-6">
              {["🧑‍💻", "👩‍🎨", "🎬", "🤖", "🌍"].map((e, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm">{e}</div>
              ))}
              <span className="text-[11px] text-gray-500 font-mono">+500 members</span>
            </div>
            <a href="https://discord.gg/amkaai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-black transition shadow-[0_0_24px_rgba(99,102,241,0.3)]">
              Join Discord →
            </a>
          </motion.div>

          {/* Affiliate */}
          <motion.div whileHover={{ y: -3 }} className="relative rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-teal-950/20 p-8 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="text-4xl mb-4">💸</div>
            <h3 className="text-xl font-black text-white mb-2">Affiliate Program</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">Earn <span className="text-emerald-400 font-bold">30% recurring commission</span> for every user you refer. No cap, paid monthly directly to your account.</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { val: "30%", label: "Commission" },
                { val: "90d", label: "Cookie" },
                { val: "Monthly", label: "Payouts" },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                  <p className="text-base font-black text-emerald-400">{s.val}</p>
                  <p className="text-[10px] text-gray-600 font-mono mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <a href="mailto:affiliate@amkaai.net" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition shadow-[0_0_24px_rgba(16,185,129,0.3)]">
              Apply Now →
            </a>
          </motion.div>

        </div>
      </section>

      {/* 🎛️ STUDIO CONSOLE — يظهر فقط بعد اختيار أداة */}
      {studioVisible && (
      <section id="studio" className="relative z-10 mx-auto max-w-7xl px-6 pb-32">

        {/* Section Label مع اسم الأداة النشطة */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400 font-mono flex items-center gap-2">
              <Sparkles size={11} className="animate-pulse" />
              {activeStudioTool === "ai-video" && "AI Video Generator"}
              {activeStudioTool === "ai-avatar" && "Create an Avatar"}
              {activeStudioTool === "image-to-avatar" && "Image to Video"}
              {activeStudioTool === "voice-clone" && "AI Voice Cloning & Lip-Sync"}
            </span>
            <button
              onClick={() => { setStudioVisible(false); setActiveStudioTool(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="text-[10px] text-gray-600 hover:text-gray-400 border border-white/10 rounded-lg px-2.5 py-1 transition font-mono"
            >
              ✕ Close
            </button>
            <button
              onClick={() => { setStudioVisible(false); setActiveStudioTool(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 rounded-lg px-2.5 py-1 transition font-mono"
            >
              ← Home
            </button>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        </div>

        <div className="w-full rounded-3xl border border-white/10 bg-[#07070a] shadow-2xl overflow-hidden flex h-[680px]">

          {/* ── LEFT SIDEBAR ── */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ x: -280, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -280, opacity: 0 }}
                className="w-64 bg-[#070709] border-r border-white/5 flex flex-col justify-between shrink-0"
              >
                {/* Brand */}
                <div>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-400 bg-clip-text text-sm font-black tracking-tighter text-transparent flex items-center gap-2">
                      <Flame size={14} className="text-cyan-400 animate-pulse" /> AMKAAI STUDIO PRO
                    </span>
                    <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white transition"><PanelLeft size={14} /></button>
                  </div>

                  {/* New Session */}
                  <div className="p-4">
                    <button
                      onClick={() => { setDashInput(""); setDashResult(""); }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-xs font-bold text-black hover:opacity-95 transition shadow-lg"
                    >
                      <Plus size={14} /> Open Production Desk
                    </button>
                  </div>

                  {/* GPU Queue */}
                  <div className="px-4 mb-4">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Active GPU Queue</span>
                        <span className="text-cyan-400 font-mono animate-pulse">● Live</span>
                      </p>
                      <div className="space-y-2 max-h-[120px] overflow-y-auto">
                        {renderQueue.length === 0 && (
                          <p className="text-[10px] text-gray-600 font-mono text-center py-2">No active jobs</p>
                        )}
                        {renderQueue.map(job => (
                          <div key={job.id} className="text-[11px] bg-black/40 p-2 rounded-lg border border-white/5">
                            <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                              <span className="truncate max-w-[110px] font-mono">{job.prompt}</span>
                              <span className="text-cyan-400 font-mono">{job.progress}%</span>
                            </div>
                            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${job.progress}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom — Credits & User */}
                <div className="p-4 border-t border-white/5 space-y-3">
                  <div className={`rounded-xl border p-3 flex justify-between items-center text-xs ${credits <= 0 ? "border-red-500/30 bg-red-500/5" : credits < 50 ? "border-amber-500/30 bg-amber-500/5" : "border-cyan-500/20 bg-cyan-500/5"}`}>
                    <span className="text-gray-400 font-mono">Allocation State</span>
                    <span className={`font-bold font-mono ${credits <= 0 ? "text-red-400" : credits < 50 ? "text-amber-400" : "text-cyan-400"}`}>
                      {credits <= 0 ? "No Credits" : `${credits} Nodes`}
                    </span>
                  </div>
                  {credits <= 0 && (
                    <p className="text-[10px] text-red-400 font-mono text-center">
                      {locale === 'ar' ? '⚠️ رصيدك انتهى — اشترك للمتابعة' : '⚠️ Credits depleted — upgrade to continue'}
                    </p>
                  )}
                  <button
                    onClick={() => setPricingModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition"
                  >
                    💎 Upgrade Plan
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── MAIN AREA ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* SYNTHESIS CONTROL HUB */}
            <div className="w-72 border-r border-white/5 bg-[#050507] p-5 space-y-5 overflow-y-auto shrink-0">
              
              {/* Toggle sidebar if closed */}
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="mb-2 text-gray-500 hover:text-white transition"><PanelLeft size={14} /></button>
              )}

              <div className="flex items-center gap-1.5 border-b border-white/5 pb-3">
                <SlidersHorizontal size={13} className="text-cyan-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Synthesis Control Hub</h2>
              </div>

              {/* AI Generation Engine */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">AI Generation Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setDashType("ai-video")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 ${dashType === "ai-video" ? "bg-purple-600/10 border-purple-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                    <Video size={14} className={dashType === "ai-video" ? "text-purple-400" : "text-gray-500"} />
                    <div>
                      <p className="text-[11px] font-black tracking-tight">AI Video Generator</p>
                      <span className="text-[9px] text-gray-500 font-mono">Text to Video</span>
                    </div>
                  </button>

                  <button onClick={() => setDashType("ai-avatar")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 ${dashType === "ai-avatar" ? "bg-cyan-600/10 border-cyan-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                    <UserSquare2 size={14} className={dashType === "ai-avatar" ? "text-cyan-400" : "text-gray-500"} />
                    <div>
                      <p className="text-[11px] font-black tracking-tight">Create an Avatar</p>
                      <span className="text-[9px] text-gray-500 font-mono">Photo Presenter</span>
                    </div>
                  </button>

                  <button onClick={() => setDashType("image-to-avatar")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 ${dashType === "image-to-avatar" ? "bg-emerald-600/10 border-emerald-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                    <ImageIcon size={14} className={dashType === "image-to-avatar" ? "text-emerald-400" : "text-gray-500"} />
                    <div>
                      <p className="text-[11px] font-black tracking-tight">Image To Video</p>
                      <span className="text-[9px] text-gray-500 font-mono">HeyGen Engine Mode</span>
                    </div>
                  </button>

                  <button onClick={() => setDashType("voice-clone")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 ${dashType === "voice-clone" ? "bg-amber-600/10 border-amber-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                    <Mic size={14} className={dashType === "voice-clone" ? "text-amber-400" : "text-gray-500"} />
                    <div>
                      <p className="text-[10px] font-black tracking-tight leading-none">AI Voice Cloning & Lip-Sync</p>
                      <span className="text-[9px] text-gray-500 font-mono">Cloning Matrix</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Aspect Dimensions */}
              {dashType !== "voice-clone" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Aspect Dimensions</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["16:9", "9:16", "1:1"] as AspectRatioType[]).map((r) => (
                      <button key={r} onClick={() => setDashAspect(r)} className={`py-1.5 text-xs rounded-xl border font-mono transition ${dashAspect === r ? "border-cyan-500 text-cyan-400 bg-cyan-500/10 font-bold" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>{r}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera Lens */}
              {dashType === "ai-video" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Move size={11} /> Camera Lens Vector</label>
                  <select value={dashCamera} onChange={(e) => setDashCamera(e.target.value)} className="w-full bg-black text-xs text-gray-400 border border-white/10 rounded-xl p-2.5 outline-none font-mono">
                    <option value="static">Static Lens</option>
                    <option value="zoom-in">Zoom In Vector</option>
                    <option value="zoom-out">Zoom Out Vector</option>
                    <option value="pan-left">Pan Left Vector</option>
                    <option value="pan-right">Pan Right Vector</option>
                  </select>
                </div>
              )}

              {/* ── POWER TOOLS ── */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Power Tools</label>

                {/* Use Template */}
                <button
                  onClick={() => setTemplateModalOpen(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition text-left group"
                >
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20 transition">
                    <Layers3 size={13} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-300">Use Template</p>
                    <p className="text-[9px] text-gray-600 font-mono">6 ready-made prompts</p>
                  </div>
                </button>

                {/* Script to Video */}
                <button
                  onClick={() => { setScriptMode(!scriptMode); setDashInput(""); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left group ${scriptMode ? "border-indigo-500 bg-indigo-500/10" : "bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5"}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${scriptMode ? "bg-indigo-500/20" : "bg-indigo-500/10 group-hover:bg-indigo-500/20"}`}>
                    <FileText size={13} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-300">Script to Video</p>
                    <p className="text-[9px] text-gray-600 font-mono">{scriptMode ? "✓ Script mode ON" : "Full script → video"}</p>
                  </div>
                </button>

                {/* Style Transfer */}
                <label className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left group cursor-pointer ${styleTransferImg ? "border-emerald-500 bg-emerald-500/10" : "bg-white/5 border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5"}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${styleTransferImg ? "bg-emerald-500/20" : "bg-emerald-500/10"}`}>
                    <Palette size={13} className="text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-gray-300">Style Transfer</p>
                    <p className="text-[9px] text-gray-600 font-mono">{styleTransferImg ? "✓ Style image loaded" : "Upload reference image"}</p>
                  </div>
                  {styleTransferImg && (
                    <button onClick={(e) => { e.preventDefault(); setStyleTransferImg(null); }} className="text-gray-500 hover:text-red-400 transition text-[10px]">✕</button>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setStyleTransferImg(reader.result as string);
                    reader.readAsDataURL(file);
                  }} />
                </label>

                {/* Add Subtitles */}
                <button
                  onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition text-left group ${subtitlesEnabled ? "border-amber-500 bg-amber-500/10" : "bg-white/5 border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5"}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${subtitlesEnabled ? "bg-amber-500/20" : "bg-amber-500/10"}`}>
                    <span className="text-amber-400 text-xs font-black">CC</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-300">Add Subtitles</p>
                    <p className="text-[9px] text-gray-600 font-mono">{subtitlesEnabled ? "✓ Auto-subtitles ON" : "Auto-generated captions"}</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── CINEMA MONITOR + INPUT ── */}
            <div className="flex-1 flex flex-col bg-black overflow-hidden">

              {/* Cinema Monitor Stage */}
              <div className="flex-1 relative flex items-center justify-center bg-[#060608] overflow-hidden">

                {/* Top bar */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/5">
                  <div className="text-[9px] uppercase font-mono tracking-widest text-gray-400 flex items-center gap-1.5">
                    <Tv size={11} className="text-cyan-400" /> Cinema Monitor Stage
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Duration selector */}
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                      {([5, 10, 30, 60] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setDuration(d)}
                          className={`px-2 py-1 rounded-md text-[9px] font-black font-mono transition ${duration === d ? "bg-cyan-500 text-black" : "text-gray-500 hover:text-white"}`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                    {/* Watermark toggle */}
                    <button
                      onClick={() => setWatermarkOff(v => !v)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold border transition ${watermarkOff ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-white/5 border-white/10 text-gray-500 hover:text-white"}`}
                    >
                      <span className={`w-3 h-3 rounded-full border transition flex items-center justify-center ${watermarkOff ? "bg-blue-500 border-blue-500" : "border-gray-600"}`}>
                        {watermarkOff && <span className="w-1.5 h-1.5 bg-white rounded-full block" />}
                      </span>
                      <span>Watermark {watermarkOff ? "Off" : "On"}</span>
                      {!watermarkOff && <span className="text-[8px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 rounded">subscribers only</span>}
                    </button>
                    {/* Live counter */}
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      <TrendingUp size={10} /> {videosGenerated.toLocaleString()} videos today
                    </div>
                    {/* ETA */}
                    {dashLoading && renderETA !== null && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg animate-pulse">
                        <Clock size={10} /> ~{renderETA}s
                      </div>
                    )}
                  </div>
                </div>

                {/* Credit Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 z-10 px-4 py-2 bg-black/60 backdrop-blur-md border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap">Credits</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${credits <= 0 ? "bg-red-500" : credits < 50 ? "bg-amber-400" : "bg-gradient-to-r from-cyan-500 to-indigo-500"}`}
                        style={{ width: `${Math.min(100, (credits / 300) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-mono font-bold whitespace-nowrap ${credits <= 0 ? "text-red-400" : credits < 50 ? "text-amber-400" : "text-cyan-400"}`}>
                      {credits}/300
                    </span>
                    {credits < 50 && (
                      <button onClick={() => setPricingModalOpen(true)} className="text-[9px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-lg hover:bg-amber-500/20 transition whitespace-nowrap">
                        ⚡ Top Up
                      </button>
                    )}
                  </div>
                </div>

                {dashResult && !dashLoading ? (
                  <div className="w-full h-full relative flex items-center justify-center p-4 pt-14 pb-10">
                    {dashType === "voice-clone" ? (
                      <audio src={dashResult} controls className="w-[70%] accent-amber-400" />
                    ) : (
                      <video src={dashResult} controls autoPlay loop className="max-h-full max-w-full rounded-xl object-contain" />
                    )}
                    {/* Action buttons after generation */}
                    <div className="absolute bottom-14 right-4 flex flex-col gap-2">
                      <a href={dashResult} download target="_blank" rel="noreferrer" className="bg-black/80 hover:bg-cyan-500 hover:text-black p-2.5 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all text-white">
                        <Download size={13} /> Export
                      </a>
                      <button onClick={() => setShareModalOpen(true)} className="bg-black/80 hover:bg-indigo-500 hover:text-white p-2.5 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all text-gray-300">
                        <Share2 size={13} /> Share
                      </button>
                    </div>
                  </div>
                ) : dashLoading ? (
                  <div className="text-center space-y-3 pt-8">
                    <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[11px] text-cyan-400 font-mono tracking-wider animate-pulse">Rendering sequence pipeline via live GPU nodes...</p>
                    {renderETA !== null && (
                      <p className="text-[10px] text-gray-600 font-mono">Estimated completion in {renderETA}s</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center pt-8">
                    <Wand2 size={36} className="mx-auto text-zinc-800 mb-3" />
                    <p className="text-xs text-gray-600 font-bold font-mono">Workspace Pipeline Standby</p>
                    <p className="text-[10px] text-gray-700 font-mono mt-1">Describe your production criteria below</p>
                  </div>
                )}
              </div>

              {/* Input Desk */}
              <div className="p-4 border-t border-white/5 bg-[#070709]/90 backdrop-blur-md space-y-3">
                {/* Preset Styles */}
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_STYLES.map(s => (
                    <button key={s.id} onClick={() => setDashInput(prev => (prev.trim() + " " + s.suffix).trim())} className="h-8 rounded-xl border border-white/5 bg-neutral-900 hover:border-white/20 transition text-[10px] font-bold text-gray-400 truncate px-2">
                      {s.name}
                    </button>
                  ))}
                </div>

                {/* Script mode label */}
                {scriptMode && (
                  <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-mono">
                    <FileText size={11} /> Script Mode — paste your full script below, it will be converted to video
                  </div>
                )}

                {/* Style transfer preview */}
                {styleTransferImg && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                    <Palette size={11} />
                    <span>Style reference loaded — video will match this aesthetic</span>
                    <img src={styleTransferImg} alt="style" className="w-8 h-8 rounded-lg object-cover border border-emerald-500/30 ml-auto" />
                  </div>
                )}

                {/* Text Input + Send */}
                <div className="space-y-1.5">
                  {/* Quality indicator */}
                  {promptQuality && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wide">Prompt Quality</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-6 h-1.5 rounded-full transition-all duration-300 ${promptQuality === "poor" || promptQuality === "good" || promptQuality === "excellent" ? "bg-red-500" : "bg-white/10"}`} />
                        <div className={`w-6 h-1.5 rounded-full transition-all duration-300 ${promptQuality === "good" || promptQuality === "excellent" ? "bg-amber-400" : "bg-white/10"}`} />
                        <div className={`w-6 h-1.5 rounded-full transition-all duration-300 ${promptQuality === "excellent" ? "bg-emerald-500" : "bg-white/10"}`} />
                      </div>
                      <span className={`text-[9px] font-black uppercase font-mono tracking-wide transition-all duration-300 ${promptQuality === "poor" ? "text-red-400" : promptQuality === "good" ? "text-amber-400" : "text-emerald-400"}`}>
                        {promptQuality === "poor" ? "⚠ Poor" : promptQuality === "good" ? "◐ Good" : "✦ Excellent"}
                      </span>
                    </div>
                  )}
                <div className="flex items-end gap-3 bg-[#030304] border border-white/10 rounded-2xl p-2.5 transition-all duration-300 focus-within:border-cyan-500/60 focus-within:shadow-[0_0_0_1px_rgba(6,182,212,0.3),0_0_20px_rgba(6,182,212,0.15)] focus-within:bg-[#060810]">
                  <textarea
                    value={dashInput}
                    onChange={(e) => setDashInput(e.target.value)}
                    placeholder={scriptMode ? "Paste your full script here — Scene 1: ...\nScene 2: ...\nNarrator: ..." : dashType === "voice-clone" ? "اكتب النص المراد تحويله لبصمتك الصوتية..." : "Describe your production criteria for this pipeline execution..."}
                    rows={scriptMode ? 4 : 2}
                    className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-1.5 text-xs outline-none text-white placeholder:text-gray-700 font-mono"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !scriptMode) { e.preventDefault(); executeDash(); } }}
                  />
                  <button
                    onClick={executeDash}
                    disabled={dashLoading}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-black disabled:opacity-20 transition shadow-md ${credits <= 0 ? "bg-amber-400 hover:bg-amber-300" : "bg-cyan-500 hover:bg-cyan-400"}`}
                    title={credits <= 0 ? "Upgrade to continue" : "Send"}
                  >
                    {credits <= 0 ? <span className="text-[9px] font-black">💎</span> : <Send size={14} />}
                  </button>
                </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-mono text-zinc-600">
          <ShieldCheck size={12} className="text-cyan-500/60" /> Secure payment gateways layered via Lemon Squeezy Merchant Global Node.
        </div>
      </section>
      )} {/* end studioVisible */}

      {/* ════════════════════════════════════
          FOOTER
      ════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/5 bg-[#070709]/80 backdrop-blur-md mt-8">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-lg font-black bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent mb-3">
                <Sparkles size={16} className="text-cyan-400" /> AMKAAI
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed max-w-[180px]">The world's most powerful AI cinematic engine — built for creators.</p>
              <div className="flex items-center gap-3 mt-4">
                <a href="https://discord.gg/amkaai" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-xl border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center text-sm hover:bg-indigo-500/20 transition" title="Discord">💬</a>
                <a href="https://twitter.com/amkaai" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-sm hover:bg-white/10 transition" title="Twitter/X">𝕏</a>
              </div>
            </div>
            {/* Product */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-4 font-mono">Product</p>
              <div className="space-y-2.5">
                {["AI Video Generator", "AI Avatar Creator", "Voice Cloning", "Image to Video"].map(l => (
                  <button key={l} onClick={() => openStudio("ai-video")} className="block text-[12px] text-gray-500 hover:text-white transition text-left">{l}</button>
                ))}
              </div>
            </div>
            {/* Developers */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-4 font-mono">Developers</p>
              <div className="space-y-2.5">
                {[
                  { label: "API Reference", action: () => setDevModalOpen(true) },
                  { label: "SDKs & Libraries", action: () => setDevModalOpen(true) },
                  { label: "Webhooks", action: () => setDevModalOpen(true) },
                  { label: "Changelog", action: () => {} },
                ].map(item => (
                  <button key={item.label} onClick={item.action} className="block text-[12px] text-gray-500 hover:text-white transition text-left">{item.label}</button>
                ))}
              </div>
            </div>
            {/* Community */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-4 font-mono">Community</p>
              <div className="space-y-2.5">
                <a href="https://discord.gg/amkaai" target="_blank" rel="noreferrer" className="block text-[12px] text-gray-500 hover:text-indigo-400 transition">Discord Community</a>
                <a href="mailto:affiliate@amkaai.net" className="block text-[12px] text-gray-500 hover:text-emerald-400 transition">Affiliate Program — 30%</a>
                <button onClick={() => setPlatformModalOpen(true)} className="block text-[12px] text-gray-500 hover:text-white transition text-left">Enterprise</button>
                <a href="mailto:hello@amkaai.net" className="block text-[12px] text-gray-500 hover:text-white transition">Contact Us</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[10px] text-gray-700 font-mono">© 2025 AMKAAI. All rights reserved.</p>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
              <ShieldCheck size={11} className="text-cyan-500/40" /> Secure payments via Lemon Squeezy
            </div>
          </div>
        </div>
      </footer>
      {/* 📋 TEMPLATE MODAL */}
      <AnimatePresence>
        {templateModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setTemplateModalOpen(false); }}
          >
            <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-[#0f0f17] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2"><Layers3 size={16} className="text-cyan-400" /> Use Template</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Ready-made prompts for instant production</p>
                </div>
                <button onClick={() => setTemplateModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => { setDashInput(t.prompt); setTemplateModalOpen(false); }}
                    className="p-3.5 text-left rounded-2xl border border-white/5 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-cyan-500/5 transition group"
                  >
                    <div className="text-xl mb-2">{t.icon}</div>
                    <p className="text-xs font-black text-white group-hover:text-cyan-300 transition">{t.name}</p>
                    <p className="text-[10px] text-gray-600 mt-1 line-clamp-2 font-mono leading-relaxed">{t.prompt.slice(0, 55)}...</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔗 SHARE MODAL */}
      <AnimatePresence>
        {shareModalOpen && dashResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShareModalOpen(false); }}
          >
            <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-[#0f0f17] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-black text-white flex items-center gap-2"><Share2 size={16} className="text-indigo-400" /> Share Output</h3>
                <button onClick={() => setShareModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">✕</button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] text-gray-400 font-mono flex-1 truncate">{dashResult}</span>
                  <button onClick={() => { navigator.clipboard.writeText(dashResult); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${copied ? "bg-emerald-500 text-black" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
                  >
                    {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Twitter / X", "LinkedIn", "WhatsApp"].map(platform => (
                    <button key={platform} className="py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition text-[10px] font-bold text-gray-400 hover:text-white">
                      {platform}
                    </button>
                  ))}
                </div>
                <a href={dashResult} download className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-black font-black text-xs transition hover:opacity-90">
                  <Download size={13} /> Download & Share
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💳 PRICING UPGRADE MODAL */}
      <AnimatePresence>
        {pricingModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm px-4 pb-4 sm:pb-0"
            onClick={(e) => { if (e.target === e.currentTarget) setPricingModalOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-[#0f0f17] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div>
                  <h2 className="text-xl font-black text-white">Unlock all models</h2>
                  <h2 className="text-xl font-black text-white">with Pro!</h2>
                  <p className="text-sm text-gray-400 mt-2 font-light leading-relaxed">
                    Full access to premium AI models, image generation, and video generation.
                  </p>
                </div>
                <button onClick={() => setPricingModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition shrink-0 ml-4 mt-0.5">
                  ✕
                </button>
              </div>

              {/* Social proof */}
              <div className="mx-6 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                <p className="text-[11px] text-emerald-400 font-bold text-center">
                  🔥 7,068+ people have used this offer today!
                </p>
              </div>

              {/* Plans */}
              <div className="px-6 space-y-2.5 mb-5">
                {/* Trial */}
                <button
                  onClick={() => setSelectedPlan("trial")}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition ${selectedPlan === "trial" ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-white/[0.02]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPlan === "trial" ? "border-blue-500" : "border-gray-600"}`}>
                      {selectedPlan === "trial" && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-sm font-bold text-white">3-Day Full Access Trial</span>
                  </div>
                  <span className="text-sm font-black text-white">$1.99</span>
                </button>

                {/* Quarterly */}
                <button
                  onClick={() => setSelectedPlan("quarterly")}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition ${selectedPlan === "quarterly" ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-white/[0.02]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPlan === "quarterly" ? "border-blue-500" : "border-gray-600"}`}>
                      {selectedPlan === "quarterly" && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-sm font-bold text-white">Quarterly</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">Save 33%</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white">$14.99</div>
                    <div className="text-[10px] text-gray-500">per month</div>
                  </div>
                </button>

                {/* Biannually */}
                <button
                  onClick={() => setSelectedPlan("biannually")}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition ${selectedPlan === "biannually" ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-white/[0.02]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedPlan === "biannually" ? "border-blue-500" : "border-gray-600"}`}>
                      {selectedPlan === "biannually" && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                    </div>
                    <span className="text-sm font-bold text-white">6 Months</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">Save 44%</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white">$12.99</div>
                    <div className="text-[10px] text-gray-500">per month</div>
                  </div>
                </button>
              </div>

              {/* Fine print */}
              <div className="px-6 mb-5">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  {selectedPlan === "trial"
                    ? "Get a 3-day trial for just $1.99. After the trial, you'll be charged $17.99/month unless you cancel through your account settings."
                    : selectedPlan === "quarterly"
                    ? "Billed as $44.97 every 3 months. Cancel anytime through your account settings."
                    : "Billed as $77.94 every 6 months. Cancel anytime through your account settings."
                  }{" "}
                  By tapping Purchase, you agree to our <span className="underline cursor-pointer">Terms</span>, <span className="underline cursor-pointer">Privacy</span> and <span className="underline cursor-pointer">Refund Policy</span>.
                </p>
              </div>

              {/* Due now */}
              <div className="px-6 flex items-center justify-between mb-4">
                <span className="text-base font-black text-white">Due now</span>
                <span className="text-base font-black text-white">
                  {selectedPlan === "trial" ? "$1.99" : selectedPlan === "quarterly" ? "$44.97" : "$77.94"}
                </span>
              </div>

              {/* CTA Button */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => { setPricingModalOpen(false); goToCheckout(selectedPlan); }}
                  disabled={loadingPlan !== null}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:opacity-90 transition disabled:opacity-50"
                >
                  {loadingPlan ? "Processing..." : "Purchase Now →"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════
          DEVELOPERS MODAL
      ══════════════════════════════════════ */}
      <AnimatePresence>
        {devModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setDevModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative w-full max-w-3xl rounded-3xl border border-cyan-500/20 bg-[#07070b] overflow-hidden shadow-2xl shadow-cyan-500/10"
            >
              {/* top accent bar */}
              <div className="h-[3px] w-full bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500" />

              {/* close */}
              <button
                onClick={() => setDevModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition text-sm"
              >✕</button>

              <div className="p-8 pt-7">
                {/* heading */}
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl shrink-0">⚡</div>
                  <div>
                    <h2 className="text-[22px] font-black text-white tracking-tight leading-tight">AMKAAI for Developers</h2>
                    <p className="text-[11px] text-cyan-400 font-mono mt-0.5">REST API · SDKs · Webhooks · Real-time Streaming</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-7 leading-relaxed max-w-2xl">
                  Integrate the full power of AMKAAI's AI engine directly into your apps and pipelines.
                  Generate cinematic videos, lifelike avatars, and voice clones at scale — with a single API call.
                </p>

                {/* code block */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#0b0b10] p-5 mb-6 font-mono text-xs overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-4">
                    <span className="w-3 h-3 rounded-full bg-red-500/60" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
                    <span className="text-gray-600 ml-3 text-[11px]">quickstart.ts</span>
                  </div>
                  <pre className="text-gray-300 leading-6 overflow-x-auto whitespace-pre">{`import { AMKAAI } from "@amkaai/sdk";

const client = new AMKAAI({ apiKey: process.env.AMKAAI_KEY });

// Generate a cinematic AI video
const video = await client.video.generate({
  prompt:      "Professional Arabic presenter, studio lighting, 4K",
  aspectRatio: "16:9",
  duration:    10,          // seconds
  facelock:    true,
});

console.log(video.url);    // https://cdn.amkaai.com/v/abc123.mp4
console.log(video.credits); // 12  (remaining credits)`}</pre>
                </div>

                {/* feature grid */}
                <div className="grid grid-cols-3 gap-3 mb-7">
                  {[
                    { icon: "🔌", title: "REST API",       desc: "Full JSON API — OpenAPI 3.1 spec included" },
                    { icon: "📦", title: "Official SDKs",  desc: "TypeScript · Python · Go · PHP · Swift" },
                    { icon: "🪝", title: "Webhooks",       desc: "Push render status to your server in real-time" },
                    { icon: "⚡", title: "SSE Streaming",  desc: "Live progress events during generation" },
                    { icon: "🔐", title: "OAuth 2.0",      desc: "Secure token-based authentication flow" },
                    { icon: "📊", title: "Usage Dashboard",desc: "Credits, throughput, error rates at a glance" },
                  ].map(f => (
                    <div key={f.title} className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/25 hover:bg-cyan-500/[0.04] transition group cursor-default">
                      <span className="text-[22px] mb-2 block">{f.icon}</span>
                      <p className="text-[12px] font-black text-white mb-1 group-hover:text-cyan-300 transition">{f.title}</p>
                      <p className="text-[11px] text-gray-500 leading-snug">{f.desc}</p>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex gap-3">
                  <Link href="/sign-up" onClick={() => setDevModalOpen(false)} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 text-black text-sm font-black hover:opacity-90 transition shadow-[0_0_24px_rgba(6,182,212,0.25)] text-center">
                    Get Free API Key →
                  </Link>
                  <a href="mailto:api@amkaai.net" className="px-6 py-3 rounded-2xl border border-white/10 bg-white/[0.03] text-gray-300 text-sm font-bold hover:bg-white/[0.07] transition">
                    Contact API Team
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════
          PLATFORM MODAL
      ══════════════════════════════════════ */}
      <AnimatePresence>
        {platformModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setPlatformModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="relative w-full max-w-3xl rounded-3xl border border-indigo-500/20 bg-[#07070b] overflow-hidden shadow-2xl shadow-indigo-500/10"
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
              <button
                onClick={() => setPlatformModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition text-sm"
              >✕</button>

              <div className="p-8 pt-7">
                {/* heading */}
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl shrink-0">🏢</div>
                  <div>
                    <h2 className="text-[22px] font-black text-white tracking-tight leading-tight">AMKAAI Platform</h2>
                    <p className="text-[11px] text-indigo-400 font-mono mt-0.5">Enterprise · Agencies · Branded AI Workflows</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-7 leading-relaxed max-w-2xl">
                  The complete AI video production suite built for businesses, agencies, and creative teams.
                  Deploy white-labeled AI studios, fine-tune custom models on your brand, and scale on dedicated infrastructure.
                </p>

                {/* stats */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[
                    { val: "4,000+", label: "Business Clients" },
                    { val: "99.9%",  label: "Uptime SLA" },
                    { val: "180+",   label: "Countries Served" },
                    { val: "24 / 7", label: "Priority Support" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                      <p className="text-xl font-black bg-gradient-to-br from-indigo-300 to-violet-400 bg-clip-text text-transparent">{s.val}</p>
                      <p className="text-[10px] text-gray-500 mt-1.5 font-mono leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* features */}
                <div className="grid grid-cols-2 gap-3 mb-7">
                  {[
                    { icon: "🎨", title: "White-label Studio",    desc: "Your logo, domain, and brand colors — no AMKAAI branding visible to end users" },
                    { icon: "👥", title: "Team Workspaces",       desc: "Role-based access, shared asset libraries, real-time collaboration" },
                    { icon: "🤖", title: "Custom AI Models",      desc: "Fine-tune video & avatar models on your brand's visual identity and tone of voice" },
                    { icon: "🔒", title: "Enterprise Security",   desc: "SSO / SAML, audit logs, data residency options, GDPR & SOC 2 Type II" },
                    { icon: "📈", title: "Advanced Analytics",    desc: "Content performance, ROI tracking, usage heatmaps, and export reports" },
                    { icon: "🚀", title: "Dedicated GPU Cluster", desc: "Reserved rendering capacity — guaranteed SLA throughput for high-volume workloads" },
                  ].map(f => (
                    <div key={f.title} className="flex gap-3.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-indigo-500/25 hover:bg-indigo-500/[0.04] transition group cursor-default">
                      <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
                      <div>
                        <p className="text-[12px] font-black text-white mb-1 group-hover:text-indigo-300 transition">{f.title}</p>
                        <p className="text-[11px] text-gray-500 leading-snug">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setPlatformModalOpen(false); setPricingModalOpen(true); }}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-black hover:opacity-90 transition shadow-[0_0_24px_rgba(99,102,241,0.25)]"
                  >
                    Start Enterprise Trial →
                  </button>
                  <button className="px-6 py-3 rounded-2xl border border-white/10 bg-white/[0.03] text-gray-300 text-sm font-bold hover:bg-white/[0.07] transition">
                    Talk to Sales
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
