"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { VIDEO_CREDITS_PER_SECOND } from "@/lib/config";
import { 
  Video, ImageIcon, Wand2, Sparkles, ArrowLeft, Loader2, Play, Film,
  Plus, LifeBuoy, X, PanelLeft, Mic, SlidersHorizontal, Tv, Flame, Upload, 
  Move, Download, Columns, Layers3, UserSquare2, Send, Bot, User
} from "lucide-react";

////////////////////////////////////////////////////////////
// TYPES & SCHEMAS
////////////////////////////////////////////////////////////
type MediaType = "ai-video" | "ai-avatar" | "image-to-video" | "voice-clone";
type AspectRatioType = "16:9" | "9:16" | "1:1";
type CameraMotionType = "static" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right";
type PresetStyle = { id: string; name: string; promptSuffix: string; bgClass: string };

type Message = {
  role: "user" | "assistant";
  content: string;
  outputUrl?: string; 
  meta?: { 
    type?: MediaType; 
    aspectRatio?: AspectRatioType; 
    motion?: string; 
    duration?: string;
  }
};

type Chat = { id: string; title: string; createdAt: number; messages: Message[] };
type RenderJob = { id: string; prompt: string; progress: number; status: "rendering" | "completed"; type: MediaType };

const PRESET_STYLES: PresetStyle[] = [
  { id: "cyberpunk", name: "Cyberpunk neon", promptSuffix: ", cyberpunk neon style, blade runner aesthetics, high contrast, 8k", bgClass: "from-purple-950/40 via-fuchsia-950/20" },
  { id: "pixar", name: "3D Pixar Animation", promptSuffix: ", 3d animation style, pixar character design, vibrant colors, raytracing", bgClass: "from-blue-950/40 via-cyan-950/20" },
  { id: "film", name: "Vintage 70s Film", promptSuffix: ", 1970s cinematic film stock, grain, warm volumetric light, anamorphic lens", bgClass: "from-amber-950/40 via-yellow-950/20" },
  { id: "anime", name: "Anime Ghibli", promptSuffix: ", anime masterwork style, studio ghibli aesthetic, hand-drawn textures", bgClass: "from-emerald-950/40 via-teal-950/20" }
];

export default function AIChangeConsole() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [credits, setCredits] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditModalReason, setCreditModalReason] = useState<"zero" | "insufficient">("zero");
  const [creditRequired, setCreditRequired] = useState(0);
  const [creditMessage, setCreditMessage] = useState("");
  const [creditsLoaded, setCreditsLoaded] = useState(false);

  // 🎛️ خيارات التحكم الأساسية لـ Generation Pipeline
  const [activeType, setActiveType] = useState<MediaType>("ai-video");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>("16:9");
  const [creativity, setCreativity] = useState<number>(0.75);
  const [cameraMotion, setCameraMotion] = useState<CameraMotionType>("static");
  
  // ⚙️ إعدادات الـ AI Voice Cloning & Lip-Sync الخاصة والـ Face Assets
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>("ar");
  const [isLipSyncActive, setIsLipSyncActive] = useState<boolean>(false);
  const [lastGeneratedAvatarUrl, setLastGeneratedAvatarUrl] = useState<string | null>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [compareSlider, setCompareSlider] = useState(50);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportInput, setSupportInput] = useState("");

  const [renderQueue, setRenderQueue] = useState<RenderJob[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const createChat = useCallback(() => {
    const chat: Chat = { id: crypto.randomUUID(), title: "New Production Desktop", createdAt: Date.now(), messages: [] };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setUploadedImage(null);
  }, []);

  useEffect(() => { if (chats.length === 0) createChat(); }, [chats.length, createChat]);

  useEffect(() => {
    let cancelled = false;
    const loadCredits = async () => {
      try {
        const res = await fetch("/api/credits", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const value = typeof data?.credits === "number" ? data.credits : typeof data?.remainingCredits === "number" ? data.remainingCredits : null;
        if (!cancelled && value !== null) setCredits(Math.max(0, value));
      } catch (error) {
        console.error("Credits fetch failed:", error);
      } finally {
        if (!cancelled) setCreditsLoaded(true);
      }
    };
    loadCredits();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, isGenerating]);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId), [chats, activeChatId]);
  const lastMessage = activeChat?.messages[activeChat.messages.length - 1];

  const handlePresetApply = (style: PresetStyle) => {
    setPrompt((prev) => `${prev.trim()} ${style.promptSuffix}`.trim());
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setVoiceSampleUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 🔥 دالة توليد الفيديو الحية وتحديث قائمة الانتظار (Queue) والسجلات
  // 🔥 دالة توليد الفيديو الحية وتحديث قائمة الانتظار (Queue) والسجلات
  const handleGenerateVideo = async () => {
    if (!prompt.trim() || !activeChat) return alert("الرجاء كتابة الوصف النصي أولاً!");

    if ((activeType === "ai-avatar" || activeType === "image-to-video") && !uploadedImage) {
      alert("الرجاء رفع صورة الأفاتار أو المشهد أولاً من لوحة التحكم الجانبية.");
      return;
    }

    // Friendly pre-check for video generations. Other tool costs remain server-controlled.
    const estimatedRequiredCredits = activeType === "ai-video" ? selectedDuration * VIDEO_CREDITS_PER_SECOND : 0;

    if (creditsLoaded && credits <= 0) {
      setCreditModalReason("zero");
      setCreditRequired(estimatedRequiredCredits);
      setCreditMessage("You have used all your available credits.");
      setCreditModalOpen(true);
      return;
    }

    if (estimatedRequiredCredits > 0 && credits < estimatedRequiredCredits) {
      setCreditModalReason("insufficient");
      setCreditRequired(estimatedRequiredCredits);
      setCreditMessage("You don't have enough credits for this generation.");
      setCreditModalOpen(true);
      return;
    }

    const currentPrompt = prompt;
    const userMsg: Message = { role: "user", content: currentPrompt, meta: { type: activeType, aspectRatio, motion: cameraMotion } };

    setChats((prev) =>
      prev.map((c) => c.id === activeChatId ? { ...c, title: c.messages.length === 0 ? currentPrompt.slice(0, 22) + "..." : c.title, messages: [...c.messages, userMsg] } : c)
    );
    
    setPrompt("");
    setIsGenerating(true);
    setProgress(5);

    const clientJobId = crypto.randomUUID();
    setRenderQueue(prev => [{ id: clientJobId, prompt: currentPrompt, progress: 5, status: "rendering", type: activeType }, ...prev]);


    try {
      let targetEndpoint = "/api/generate-video";
      if (activeType === "ai-avatar") targetEndpoint = "/api/generate-avatar";
      if (activeType === "image-to-video") targetEndpoint = "/api/generate-image";
      if (activeType === "voice-clone") targetEndpoint = "/api/generate-voice";

     const requestBody: any = { 
  prompt: currentPrompt,
  duration: selectedDuration
};
      if (activeType === "ai-video") {
        requestBody.aspectRatio = aspectRatio;
        requestBody.cameraMotion = cameraMotion;
        requestBody.creativity = creativity;
      } else if (activeType === "ai-avatar" || activeType === "image-to-video") {
        requestBody.uploadedImage = uploadedImage;
        requestBody.aspectRatio = aspectRatio;
      } else if (activeType === "voice-clone") {
        requestBody.text = currentPrompt;
        requestBody.voiceSampleUrl = voiceSampleUrl;
        requestBody.language = targetLanguage;
        requestBody.targetAvatarVideo = isLipSyncActive ? lastGeneratedAvatarUrl : null;
      }

      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientJobId },
        body: JSON.stringify(requestBody)
      });

      // 402 = insufficient credits; show a friendly modal instead of redirecting.
      if (response.status === 402) {
        let data: any = {};
        try { data = await response.json(); } catch { /* empty response */ }
        const serverRemaining = typeof data?.remainingCredits === "number" ? Math.max(0, data.remainingCredits) : credits;
        const serverRequired = typeof data?.requiredCredits === "number" ? Math.max(0, data.requiredCredits) : estimatedRequiredCredits;
        setCredits(serverRemaining);
        setCreditRequired(serverRequired);
        setCreditModalReason(serverRemaining <= 0 ? "zero" : "insufficient");
        setCreditMessage(typeof data?.error === "string" ? data.error : serverRemaining <= 0 ? "You have used all your available credits." : "You don't have enough credits for this generation.");
        setCreditModalOpen(true);
        setRenderQueue(prev => prev.filter(j => j.id !== clientJobId));
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || "حدث خطأ غير متوقع");
      }

      let data = await response.json();
      if (activeType === "ai-video" && data.jobId) {
        let finished = false;
        for (let attempt = 0; attempt < 180; attempt++) {
          const check = await fetch(`/api/generate-video/status?jobId=${encodeURIComponent(data.jobId)}`, { cache: "no-store" });
          const state = await check.json();
          if (typeof state.progress === "number") {
            setProgress(state.progress);
            setRenderQueue(q => q.map(j => j.id === clientJobId ? { ...j, progress: state.progress } : j));
          }
          if (state.status === "done") { data = { ...data, videoUrl: state.videoUrl || state.video }; finished = true; break; }
          if (state.status === "failed" || state.status === "cancelled") throw new Error(state.error || "Video generation failed");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!finished) throw new Error("Video generation timed out");
      }

      // الصورة-إلى-فيديو (خارج وضع الديمو) يرجع فوراً بحالة "processing" مع
      // generationId، ويحتاج استطلاعاً منفصلاً لأن التوليد الفعلي يعمل بشكل
      // غير متزامن على خوادم Replicate.
      if (activeType === "image-to-video" && data.status === "processing" && data.generationId) {
        let finished = false;
        for (let attempt = 0; attempt < 150; attempt++) {
          setProgress(Math.min(95, 5 + attempt));
          setRenderQueue(q => q.map(j => j.id === clientJobId ? { ...j, progress: Math.min(95, 5 + attempt) } : j));
          const check = await fetch(`/api/generate-image/status?generationId=${encodeURIComponent(data.generationId)}`, { cache: "no-store" });
          const state = await check.json();
          if (state.status === "done") { data = { ...data, videoUrl: state.videoUrl }; finished = true; break; }
          if (state.status === "failed") throw new Error(state.error || "Video generation failed. Your credits were refunded.");
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
        if (!finished) throw new Error("Video generation timed out");
      }
      setProgress(100);

      const outputUrl = data.videoUrl || data.avatar || data.outputUrl || null;
      if (!outputUrl) throw new Error("No output was returned by the generation pipeline");

      if (activeType === "ai-avatar" && outputUrl) {
        setLastGeneratedAvatarUrl(outputUrl);
      }

      const reply: Message = { 
        role: "assistant", 
        content: `⚡ تم الانتهاء من معالجة روتينات الإخراج بنجاح.\n• الرصيد المتبقي: ${data.remainingCredits ?? credits}`, 
        outputUrl: outputUrl,
        meta: { type: (activeType === "voice-clone" && isLipSyncActive) ? "ai-video" : activeType }
      };

      setChats((prev) => prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, reply] } : c));
      setRenderQueue(prev => prev.map(j => j.id === clientJobId ? { ...j, progress: 100, status: "completed" } : j));
      setCredits(data.remainingCredits ?? credits);

    } catch (e: any) {
      console.error(e);
      alert(e.message || "حدث خطأ أثناء التوليد");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#eaf7f2] text-slate-800 font-sans selection:bg-cyan-500/40">
      
      {/* SIDEBAR ARCHIVE SYSTEM */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} className="w-72 border-r border-teal-900/10 bg-[#d9eee6] flex flex-col justify-between z-30">
            <div>
              <div className="border-b border-teal-900/10 p-5 flex items-center justify-between">
                <Link href="/" className="bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500 bg-clip-text text-md font-black tracking-tighter text-transparent flex items-center gap-2">
                  <Flame size={16} className="text-teal-600 animate-pulse" /> AMKAAI STUDIO PRO
                </Link>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-slate-800 transition"><PanelLeft size={16} /></button>
              </div>

              <div className="p-4">
                <button onClick={createChat} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-800 hover:opacity-95 transition shadow-lg">
                  <Plus size={14} /> Open Production Desk
                </button>
              </div>

              {/* RENDER QUEUE SYSTEM */}
              <div className="px-4 mb-4">
                <div className="bg-white/95 rounded-xl p-3 border border-teal-900/10 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Active GPU Queue</span>
                    <span className="text-teal-600 font-mono animate-pulse">● Live</span>
                  </p>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {renderQueue.map(job => (
                      <div key={job.id} className="text-[11px] bg-white/95 p-2 rounded-lg border border-teal-900/10">
                        <div className="flex justify-between text-slate-500 text-[10px] mb-1">
                          <span className="truncate max-w-[120px] font-mono">{job.prompt}</span>
                          <span className="text-teal-600 font-mono">{job.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200/60 h-1 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${job.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-teal-900/10 bg-white/70">
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-mono">Allocation State</span>
                <span className="font-bold text-teal-600 font-mono">{credits} Nodes</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* CORE CONTROL DESK */}
      <section className="flex flex-1 flex-col overflow-hidden">
        
        <header className="flex items-center justify-between border-b border-teal-900/10 bg-[#d9eee6]/70 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3 bg-white/95 px-3 py-2 rounded-xl border border-teal-900/10 shadow-xl">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-800 transition"><PanelLeft size={15} /></button>}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-600 flex items-center justify-center text-slate-800 shadow-lg">
              <Sparkles size={14} className="animate-pulse" />
            </div>
            <div className="w-[1px] h-5 bg-slate-200/60" />
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition">
              <ArrowLeft size={13} /> Back to Hub
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setSupportOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-teal-900/10 bg-white/95 px-3 py-2 text-xs text-slate-500 font-mono hover:text-slate-800 transition"><LifeBuoy size={12} /> Live Support</button>
            <Link href="/pricing" className="bg-gradient-to-r from-zinc-900 to-black px-4 py-2 rounded-full border border-teal-900/10 hover:border-teal-500/30 transition text-xs font-bold text-slate-600">💎 Upgrade Plan</Link>
            <button className="hidden items-center gap-1.5 rounded-xl border border-teal-900/10 bg-white/95 px-3 py-2 text-xs text-slate-500 md:flex font-mono"><Layers3 size={12} /> Asset Desk</button>
          </div>
        </header>

        {/* INTEGRATED PIPELINE WORKFLOW */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* PARAMETERS CONTROL TOWER */}
          <div className="lg:col-span-4 border-r border-teal-900/10 bg-[#e1f2ec] p-5 space-y-5 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-1.5 border-b border-teal-900/10 pb-2">
              <SlidersHorizontal size={13} className="text-teal-600" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Synthesis Control Hub</h2>
            </div>

            {/* Pipeline Buttons Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">AI Generation Engine</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setActiveType("ai-video")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "ai-video" ? "bg-teal-600/10 border-teal-500 text-slate-800" : "bg-white/95 border-teal-900/10 text-slate-500 hover:bg-slate-200/60"}`}>
                  <Video size={14} className={activeType === "ai-video" ? "text-teal-600" : "text-slate-500"} />
                  <div>
                    <p className="text-[11px] font-black tracking-tight">AI Video Generator</p>
                    <span className="text-[9px] text-slate-500 font-mono">Text to Video</span>
                  </div>
                </button>

                <button onClick={() => setActiveType("ai-avatar")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "ai-avatar" ? "bg-cyan-600/10 border-cyan-500 text-slate-800" : "bg-white/95 border-teal-900/10 text-slate-500 hover:bg-slate-200/60"}`}>
                  <UserSquare2 size={14} className={activeType === "ai-avatar" ? "text-cyan-400" : "text-slate-500"} />
                  <div>
                    <p className="text-[11px] font-black tracking-tight">Create an Avatar</p>
                    <span className="text-[9px] text-slate-500 font-mono">Photo Presenter</span>
                  </div>
                </button>

                <button onClick={() => setActiveType("image-to-video")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "image-to-video" ? "bg-emerald-600/10 border-emerald-500 text-slate-800" : "bg-white/95 border-teal-900/10 text-slate-500 hover:bg-slate-200/60"}`}>
                  <ImageIcon size={14} className={activeType === "image-to-video" ? "text-emerald-400" : "text-slate-500"} />
                  <div>
                    <p className="text-[11px] font-black tracking-tight">Image To Video</p>
                    <span className="text-[9px] text-slate-500 font-mono">HeyGen Engine Mode</span>
                  </div>
                </button>

                <button onClick={() => setActiveType("voice-clone")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "voice-clone" ? "bg-amber-600/10 border-amber-500 text-slate-800" : "bg-white/95 border-teal-900/10 text-slate-500 hover:bg-slate-200/60"}`}>
                  <Mic size={14} className={activeType === "voice-clone" ? "text-amber-400" : "text-slate-500"} />
                  <div>
                    <p className="text-[10px] font-black tracking-tight leading-none">AI Voice Cloning & Lip-Sync</p>
                    <span className="text-[9px] text-slate-500 font-mono">Cloning Matrix</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Asset Seed Uploader for Images */}
            {(activeType === "ai-avatar" || activeType === "image-to-video") && (
              <div className="space-y-1.5 border-t border-teal-900/10 pt-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Upload size={11} /> Source Face/Scene Image</label>
                <div onClick={() => imageInputRef.current?.click()} className="border border-dashed border-teal-900/10 hover:border-teal-500/30 bg-white/95 rounded-xl p-3 text-center cursor-pointer transition min-h-[90px] flex items-center justify-center">
                  <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  {uploadedImage ? (
                    <div className="relative w-full h-20 rounded-lg overflow-hidden">
                      <img src={uploadedImage} alt="Core Matrix Seed" className="w-full h-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }} className="absolute top-1 right-1 bg-white/95 p-1 rounded-full text-slate-500"><X size={10} /></button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-mono font-bold">Drop an image here or click to browse</p>
                      <p className="text-[9px] text-slate-500">Transforms Photo to Speaking Studio Avatar</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Voice Clone Upload Control Box */}
            {activeType === "voice-clone" && (
              <div className="space-y-3 border-t border-teal-900/10 pt-3 font-mono">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Mic size={11} className="text-amber-400" /> 1. Voice Sample (Instant Cloning)</label>
                  <div onClick={() => voiceInputRef.current?.click()} className="border border-dashed border-teal-900/10 bg-white rounded-xl p-2.5 text-center cursor-pointer text-[10px] text-slate-500">
                    <input type="file" ref={voiceInputRef} className="hidden" accept="audio/*" onChange={handleVoiceUpload} />
                    {voiceSampleUrl ? "✅ عينة الصوت مشحونة بنجاح في النظام" : "ارفع ملف صوتي لنفسك (5 ثوانٍ) لنطق بصمتك الصوتية"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">2. Target Language</label>
                  <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full bg-white text-xs text-slate-500 border border-teal-900/10 rounded-xl p-2 outline-none">
                    <option value="ar">العربية الفصحى 🇸🇦</option>
                    <option value="en">English US 🇺🇸</option>
                    <option value="fr">French 🇫🇷</option>
                  </select>
                </div>

                {lastGeneratedAvatarUrl && (
                  <div className="bg-teal-950/5 border border-teal-500/20 p-2.5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-teal-600 uppercase">Active Lip-Sync Overlay</label>
                      <input type="checkbox" checked={isLipSyncActive} onChange={(e) => setIsLipSyncActive(e.target.checked)} className="accent-purple-400 cursor-pointer" />
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight">دمج ومزامنة بصمة الصوت المولدة تلقائياً مع حركة شفايف آخر أفاتار قمت بإنتاجه.</p>
                  </div>
                )}
              </div>
            )}

            {/* Dimensions Control */}
            {activeType !== "voice-clone" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Aspect Dimensions</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["16:9", "9:16", "1:1"] as AspectRatioType[]).map((ratio) => (
                    <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`py-1.5 text-[11px] rounded-xl border font-mono transition ${aspectRatio === ratio ? "border-teal-500 text-teal-600 bg-teal-500/10 font-bold" : "bg-white/95 border-teal-900/10 text-slate-500 hover:bg-slate-200/60"}`}>
                      {ratio === "16:9" && "Horizontal (16:9)"}
                      {ratio === "9:16" && "Vertical (9:16)"}
                      {ratio === "1:1" && "Square (1:1)"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Vector Movement Controls */}
            {activeType === "ai-video" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Move size={11} /> Camera Lens Vector</label>
                <select value={cameraMotion} onChange={(e) => setCameraMotion(e.target.value as CameraMotionType)} className="w-full bg-white text-xs text-slate-500 border border-teal-900/10 rounded-xl p-2.5 outline-none font-mono">
                  <option value="static">Static Lens</option>
                  <option value="zoom-in">Zoom In Vector</option>
                  <option value="zoom-out">Zoom Out Vector</option>
                  <option value="pan-left">Pan Left Vector</option>
                  <option value="pan-right">Pan Right Vector</option>
                </select>
              </div>
            )}
          </div>

          {/* ADVANCED MONITOR STAGE */}
          <div className="lg:col-span-8 flex flex-col justify-between overflow-hidden bg-white relative">
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              
              <div className="relative aspect-video max-h-[400px] w-full mx-auto rounded-2xl border border-teal-900/10 bg-[#e1f2ec] flex items-center justify-center overflow-hidden shadow-2xl">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <div className="text-[9px] uppercase font-mono tracking-widest text-slate-500 bg-white/95 px-3 py-1.5 rounded-lg border border-teal-900/10 backdrop-blur-md flex items-center gap-1">
                    <Tv size={11} className="text-teal-600" /> Live AI Output Preview
                  </div>
                  {lastMessage?.outputUrl && activeType !== "voice-clone" && (
                    <button onClick={() => setCompareMode(!compareMode)} className={`flex items-center gap-1 text-[9px] font-bold uppercase font-mono px-3 py-1.5 rounded-lg border transition ${compareMode ? "bg-teal-600 text-slate-800 border-purple-400" : "bg-white/95 text-slate-500 border-teal-900/10"}`}>
                      <Columns size={11} /> Split Screen
                    </button>
                  )}
                </div>

                {lastMessage && lastMessage.outputUrl && !isGenerating ? (
                  <div className="w-full h-full relative">
                    {compareMode ? (
                      <div className="w-full h-full relative select-none">
                        <div className="absolute inset-0 bg-[#d9eee6]" style={{ clipPath: `polygon(${compareSlider}% 0, 100% 0, 100% 100%, ${compareSlider}% 100%)` }}>
                          <video src={lastMessage.outputUrl} autoPlay loop muted className="w-full h-full object-contain" />
                        </div>
                        <div className="absolute bottom-0 top-0 w-0.5 bg-purple-400 z-20" style={{ left: `${compareSlider}%` }}>
                          <input type="range" min="0" max="100" value={compareSlider} onChange={e => setCompareSlider(Number(e.target.value))} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 opacity-0 cursor-ew-resize" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full relative flex items-center justify-center">
                        {lastMessage.meta?.type === "voice-clone" ? (
                          <audio src={lastMessage.outputUrl} controls className="w-[80%] accent-purple-400" />
                        ) : (
                          <video src={lastMessage.outputUrl} controls autoPlay loop className="w-full h-full object-contain bg-white" />
                        )}
                        <a href={lastMessage.outputUrl} download target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-white/95 hover:bg-teal-500 hover:text-black p-2.5 rounded-xl border border-teal-900/10 text-xs font-bold flex items-center gap-1.5 transition-all">
                          <Download size={13} /> Export Stream
                        </a>
                      </div>
                    )}
                  </div>
                ) : isGenerating ? (
                  <div className="text-center space-y-3 px-4">
                    <Loader2 size={32} className="text-teal-600 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500">الذكاء الاصطناعي يقوم بحياكة الإطارات وتحريك الأفاتار...</p>
                    <div className="w-48 h-1 bg-slate-100 rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 space-y-2 p-6">
                    <div className="w-12 h-12 bg-white/95 rounded-full flex items-center justify-center mx-auto text-slate-500 border border-teal-900/10 shadow-inner">
                      <Play size={18} fill="currentColor" className="translate-x-0.5" />
                    </div>
                    <p className="text-xs font-black text-slate-500">Ready for Production</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">عند الضغط على التوليد، ستظهر اللقطات والتحريكات الصوتية والوجهية هنا مباشرةً.</p>
                  </div>
                )}
              </div>

              {/* Execution Log Layer */}
              {activeChat && activeChat.messages.length > 0 && (
                <div className="border-t border-teal-900/10 pt-4 space-y-3">
                  {activeChat.messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 p-3.5 rounded-xl border ${msg.role === "user" ? "bg-white/95 border-teal-900/10" : "bg-purple-950/5 border-teal-500/10"}`}>
                      {msg.role === "user" ? <User size={13} className="text-slate-500 mt-0.5" /> : <Bot size={13} className="text-teal-600 mt-0.5" />}
                      <div className="text-xs flex-1">
                        <span className="font-bold block text-[10px] text-slate-500 uppercase">{msg.role === "user" ? "Input Criteria" : "Output Tracking Matrix"}</span>
                        <p className="text-slate-600 font-mono whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Input Desk Area */}
            <div className="p-5 border-t border-teal-900/10 bg-[#d9eee6]/90 backdrop-blur-md space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-teal-600 uppercase tracking-wide">
                <Sparkles size={12} /> Describe Your Vision
              </div>

              <div className="flex items-end gap-3 bg-[#d8eee6] border border-teal-900/10 rounded-2xl p-3 transition-all duration-300 focus-within:border-teal-500/60 focus-within:shadow-[0_0_0_1px_rgba(168,85,247,0.3),0_0_20px_rgba(168,85,247,0.15)] focus-within:bg-[#e1f2ec]">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={activeType === "voice-clone" ? "اكتب هنا النص المراد تحويله لبصمتك الصوتية المستنسخة أو الصوت الجاهز..." : "Describe your cinematic vision here... e.g. A futuristic city at night with neon lights, slow camera pan, 8K ultra-realistic..."}
                  rows={3}
                  className="max-h-40 min-h-[72px] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none text-slate-800 placeholder:text-slate-400 font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerateVideo(); } }}
                />
                <button 
  onClick={() => setShowDurationModal(true)} // هذا التغيير سيفتح النافذة بدلاً من التوليد المباشر
  disabled={isGenerating || !prompt.trim()} 
  className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-slate-800 disabled:opacity-20 transition shadow-md hover:bg-teal-500 shrink-0"
>
  {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
</button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Quick Style:</span>
                {PRESET_STYLES.map(style => (
                  <button key={style.id} onClick={() => handlePresetApply(style)} className="px-3 py-1.5 rounded-full border border-teal-900/10 bg-white hover:border-teal-500/40 hover:text-slate-800 transition text-[10px] font-bold text-slate-500">
                    {style.name}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-slate-500 text-center font-mono">
                Wan 2.2 TI2V-5B • RTX 4090 on demand • 5 credits/second • 5s clips
              </div>
            </div>


          </div>
        </div>
      </section>

      {/* SUPPORT LAYER */}
      <AnimatePresence>
        {supportOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md p-4">
            <div className="w-full max-w-lg rounded-2xl border border-teal-900/10 bg-[#d9eee6] p-6 space-y-4 shadow-2xl relative">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2"><LifeBuoy size={14} className="text-teal-600" /> Support Core</h3>
                <p className="text-xs text-slate-500 font-mono mt-4 leading-relaxed bg-white/95 p-4 rounded-xl border border-teal-900/10">
                  Our clusters are operating at nominal values. If your H100 sequence allocation fails or stays inside the render queue for more than 180s, drop an analytical ticket below.
                </p>
              </div>
              <div className="flex gap-2">
                <input value={supportInput} onChange={e => setSupportInput(e.target.value)} className="flex-1 rounded-xl bg-white border border-teal-900/10 p-3 text-xs outline-none text-slate-800 font-mono" placeholder="Inquire cluster debug parameters..." />
                <button onClick={() => setSupportOpen(false)} className="rounded-xl bg-teal-500 px-5 text-xs font-bold text-black">Log Ticket</button>
              </div>
              <button onClick={() => setSupportOpen(false)} className="absolute right-4 top-4 text-slate-500 hover:text-slate-800" aria-label="Close support dispatch dashboard"><X size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
{/* Friendly credit balance modal */}
      <AnimatePresence>
        {creditModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/35 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-labelledby="credit-modal-title">
            <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }} className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white p-7 shadow-2xl">
              <button type="button" onClick={() => setCreditModalOpen(false)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={17} /></button>
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-cyan-100 text-purple-600"><Sparkles size={24} /></div>
              <div className="text-center">
                <h2 id="credit-modal-title" className="text-xl font-black tracking-tight text-slate-900">{creditModalReason === "zero" ? "You're out of credits" : "Not enough credits"}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{creditMessage || (creditModalReason === "zero" ? "You've used all your available credits. Upgrade your plan to keep creating." : "You need more credits to create this generation.")}</p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your balance</p><p className="mt-1 text-2xl font-black text-slate-900">{credits}</p><p className="text-[10px] text-slate-400">credits</p></div>
                <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 text-center"><p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Required</p><p className="mt-1 text-2xl font-black text-purple-700">{creditRequired || "—"}</p><p className="text-[10px] text-teal-600">credits</p></div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setCreditModalOpen(false)} className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Maybe Later</button>
                <Link href="/pricing" onClick={() => setCreditModalOpen(false)} className="flex-1 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-3 text-center text-sm font-black text-white shadow-lg hover:opacity-90">Upgrade Now →</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* نافذة اختيار المدة الزمنية */}
        {showDurationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-teal-900/10 bg-[#d9eee6] p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Select Video Duration</h2>
              
              <input 
                type="range" min="5" max="180" step="5" 
                value={selectedDuration} 
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500 mb-2"
              />
              <div className="flex justify-between text-xs text-slate-500 mb-6 font-mono">
                <span>5s</span><span>30s</span><span>1m</span><span>3m</span>
              </div>
              
              <div className="text-4xl font-black text-slate-800 mb-8 text-center tracking-tighter">{selectedDuration}s</div>
              
              <button 
                onClick={() => { setShowDurationModal(false); handleGenerateVideo(); }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 font-bold text-slate-800 transition hover:opacity-90"
              >
                Confirm ({selectedDuration * VIDEO_CREDITS_PER_SECOND} credits)
              </button>
            </div>
          </div>
        )}
      </main>
    );
}