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
type PlanKey = "trial" | "quarterly" | "biannually";
type MediaType = "video" | "avatar" | "voice"; 
type AspectRatioType = "16:9" | "9:16" | "1:1";
type CameraMoveType = "zoom-in" | "pan-left" | "orbit-360" | "tilt-up";

interface FeatureProps { icon: React.ReactNode; title: string; text: string; }
interface PricingCardProps {
  title: string; price: string; description: string; features: string[];
  buttonText: string; highlighted?: boolean; badgeText?: string; onClick: () => void;
}

/* ================= إعدادات الباقات المحدثة ================= */
const PLANS = {
  trial: {
    id: "trial",
    name: "3-Day Full Access Trial",
    priceMain: "$17.99",
    priceSub: "per month",
    description: "Ideal for quick testing and small projects.",
    badge: "Trial",
    features: ["30 Credits", "720p HD Access", "Priority Support"],
  },
  quarterly: {
    id: "quarterly",
    name: "Amkaai Pro Plan",
    priceMain: "$44.97",
    priceSub: "per 3 months",
    description: "Entry level tier for content creators and casual experimenters.",
    badge: "Most Popular",
    features: ["600 Credits /mo", "Standard Pipeline", "HD Downloads"],
  },
  biannually: {
    id: "biannually",
    name: "Studio Ultra 1080p",
    priceMain: "$77.94",
    priceSub: "per 6 months",
    description: "Tailored specifically for production agencies.",
    badge: "Ultra Quality",
    features: ["Uncapped Rendering", "4K Upscaling", "Commercial Use"],
  },
};

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
  const router = useRouter();       

  const [visitors, setVisitors] = useState(1482);
  const [online, setOnline] = useState(34);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [hoveredGalleryId, setHoveredGalleryId] = useState<number | null>(null);
  
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [type, setType] = useState<MediaType>("video"); 
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>("16:9");
  const [creativity, setCreativity] = useState<number>(0.75);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const [cameraMove, setCameraMove] = useState<CameraMoveType>("zoom-in");
  const [motionBrushActive, setMotionBrushActive] = useState(false);
  const [faceLockStrength, setFaceLockStrength] = useState(0.90);
  const [generateSoundFx, setGenerateSoundFx] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisitors((v) => v + Math.floor(Math.random() * 2));
      setOnline(25 + Math.floor(Math.random() * 15));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const goToCheckout = async (plan: PlanKey) => {
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
    { id: "video" as MediaType, title: "AI Video", subtitle: "توليد فيديو ذكي", icon: Video, color: "text-blue-400", bgGlow: "from-blue-500/20", placeholder: "صف موضوع أو مشهد الفيديو..." },
    { id: "avatar" as MediaType, title: "AI Avatar", subtitle: "شخصية رقمية متحدثة", icon: UserSquare2, color: "text-cyan-400", bgGlow: "from-cyan-500/20", placeholder: "اكتب النص أو السيناريو الكامل..." },
    { id: "voice" as MediaType, title: "AI Voice", subtitle: "استنساخ الصوت", icon: Mic, color: "text-amber-400", bgGlow: "from-amber-500/20", placeholder: "اكتب هنا النص المراد تحويله..." },
  ];

  const currentTabInfo = studioTabs.find(t => t.id === type)!;

  return (
    <main className="relative min-h-screen bg-[#030303] text-white">
      {/* (بقية كود الـ Header والـ Hero والـ Studio Engine كما هو تماماً في ملفك) */}
      {/* ... [تم اختصار الجزء الأوسط للحفاظ على التنسيق] ... */}

      {/* PRICING PLANS */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
        <div className="mb-14 text-center">
          <h2 className="text-xs font-black tracking-[0.2em] text-cyan-400 uppercase mb-2">Computational Costing</h2>
          <p className="text-3xl font-black tracking-tight">Flexible Studio Scaler Plans</p>
        </div>

        {/* 🌟 الباقات الثلاث الديناميكية */}
        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          {(["trial", "quarterly", "biannually"] as PlanKey[]).map((key) => {
            const p = PLANS[key];
            return (
              <PricingCard
                key={p.id}
                title={p.name}
                price={p.priceMain}
                description={p.description}
                features={p.features}
                buttonText={loadingPlan === key ? "Routing..." : `Deploy ${p.name}`}
                badgeText={p.badge}
                highlighted={key === "biannually"}
                onClick={() => goToCheckout(key)}
              />
            );
          })}
        </div>
      </section>
      
      {/* (بقية الـ FAQ والـ Footer كما في ملفك) */}
    </main>
  );
}

/* ================= المكونات المساعدة ================= */
function PricingCard({ title, price, description, features, buttonText, highlighted = false, badgeText, onClick }: PricingCardProps) {
  return (
    <motion.div whileHover={{ y: -2 }} className={`relative overflow-hidden rounded-2xl border p-7 backdrop-blur-2xl transition-all flex flex-col justify-between ${highlighted ? "border-cyan-500/20 bg-gradient-to-b from-cyan-950/10 via-black to-black shadow-2xl" : "border-white/5 bg-[#070709]"}`}>
      {badgeText && (
        <div className="absolute right-4 top-4 rounded-full bg-cyan-400 px-2.5 py-0.5 text-[8px] font-black text-black tracking-widest uppercase">
          {badgeText}
        </div>
      )}
      <div>
        <h3 className="text-[10px] font-black tracking-[0.15em] text-cyan-400 uppercase font-mono">{title}</h3>
        <p className="mt-3 text-4xl font-black tracking-tight">{price}<span className="text-xs text-gray-600 font-normal font-mono"> /cycle</span></p>
        <p className="mt-2 text-[11px] text-gray-400 font-light leading-relaxed">{description}</p>
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