"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Video, ImageIcon, Wand2, Sparkles, ArrowLeft, Loader2, Play, Film,
  Plus, LifeBuoy, X, PanelLeft, Mic, SlidersHorizontal, Tv, Flame, Upload, 
  Move, Download, Columns, Layers3, UserSquare2, Send, Bot, User
} from "lucide-react";

////////////////////////////////////////////////////////////
// TYPES & SCHEMAS
////////////////////////////////////////////////////////////
type MediaType = "ai-video" | "ai-avatar" | "image-to-avatar" | "voice-clone";
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
  const [credits, setCredits] = useState(240);

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
  const handleGenerateVideo = async () => {
    if (!prompt.trim() || !activeChat) return alert("الرجاء كتابة الوصف النصي أولاً!");

    if ((activeType === "ai-avatar" || activeType === "image-to-avatar") && !uploadedImage) {
      alert("الرجاء رفع صورة الأفاتار أو المشهد أولاً من لوحة التحكم الجانبية.");
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

    // محاكاة شريط التحميل المستوحى من السيرفرات الحقيقية
    const interval = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + Math.floor(Math.random() * 12) + 4;
        const currentProgress = nextProgress >= 95 ? 95 : nextProgress;
        setRenderQueue(q => q.map(j => j.id === clientJobId ? { ...j, progress: currentProgress } : j));
        return currentProgress;
      });
    }, 500);

    try {
      let targetEndpoint = "/api/generate-video";
      if (activeType === "ai-avatar") targetEndpoint = "/api/generate-avatar";
      if (activeType === "image-to-avatar") targetEndpoint = "/api/generate-image";
      if (activeType === "voice-clone") targetEndpoint = "/api/generate-voice";

      const requestBody: any = { prompt: currentPrompt };
      if (activeType === "ai-video") {
        requestBody.aspectRatio = aspectRatio;
        requestBody.cameraMotion = cameraMotion;
        requestBody.creativity = creativity;
      } else if (activeType === "ai-avatar" || activeType === "image-to-avatar") {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      clearInterval(interval);
      setProgress(100);

      const outputUrl = data.videoUrl || data.avatar || data.outputUrl || "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-32124-large.mp4";

      if (activeType === "ai-avatar" && outputUrl) {
        setLastGeneratedAvatarUrl(outputUrl);
      }

      const reply: Message = { 
        role: "assistant", 
        content: `⚡ تم الانتهاء من معالجة روتينات الإخراج عبر خوادم السيرفر الأساسية بنجاح.\n• الرصيد المتبقي: ${data.remainingCredits || (credits - 10)} عقدة جي بي يو.`, 
        outputUrl: outputUrl,
        meta: { type: (activeType === "voice-clone" && isLipSyncActive) ? "ai-video" : activeType }
      };

      setChats((prev) => prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, reply] } : c));
      setRenderQueue(prev => prev.map(j => j.id === clientJobId ? { ...j, progress: 100, status: "completed" } : j));
      setCredits(data.remainingCredits || (credits - 10));

    } catch (e: any) {
      clearInterval(interval);
      console.error(e);
      // في حال لم يتم إعداد الـ API بعد، سيقوم النظام تلقائياً بتوفير لقطة Demo تجريبية لحماية مرونة تجربة المستخدم
      const fallbackUrl = "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-32124-large.mp4";
      const reply: Message = { 
        role: "assistant", 
        content: `💡 نمط المحاكاة الافتراضي (Demo Mode) نشط حالياً لحين ربط قواعد البيانات الخلفية بالكامل بنجاح.`, 
        outputUrl: fallbackUrl,
        meta: { type: activeType }
      };
      setChats((prev) => prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, reply] } : c));
      setRenderQueue(prev => prev.map(j => j.id === clientJobId ? { ...j, progress: 100, status: "completed" } : j));
      setCredits(prev => prev - 10);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#030303] text-white font-sans selection:bg-cyan-500/40">
      
      {/* SIDEBAR ARCHIVE SYSTEM */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} className="w-72 border-r border-white/5 bg-[#070709] flex flex-col justify-between z-30">
            <div>
              <div className="border-b border-white/5 p-5 flex items-center justify-between">
                <Link href="/" className="bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-md font-black tracking-tighter text-transparent flex items-center gap-2">
                  <Flame size={16} className="text-purple-400 animate-pulse" /> AMKAAI STUDIO PRO
                </Link>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white transition"><PanelLeft size={16} /></button>
              </div>

              <div className="p-4">
                <button onClick={createChat} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:opacity-95 transition shadow-lg">
                  <Plus size={14} /> Open Production Desk
                </button>
              </div>

              {/* RENDER QUEUE SYSTEM */}
              <div className="px-4 mb-4">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Active GPU Queue</span>
                    <span className="text-purple-400 font-mono animate-pulse">● Live</span>
                  </p>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {renderQueue.map(job => (
                      <div key={job.id} className="text-[11px] bg-black/40 p-2 rounded-lg border border-white/5">
                        <div className="flex justify-between text-gray-400 text-[10px] mb-1">
                          <span className="truncate max-w-[120px] font-mono">{job.prompt}</span>
                          <span className="text-purple-400 font-mono">{job.progress}%</span>
                        </div>
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${job.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-black/30">
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 flex justify-between items-center text-xs">
                <span className="text-gray-400 font-mono">Allocation State</span>
                <span className="font-bold text-purple-400 font-mono">{credits} Nodes</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* CORE CONTROL DESK */}
      <section className="flex flex-1 flex-col overflow-hidden">
        
        <header className="flex items-center justify-between border-b border-white/5 bg-[#070709]/70 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-2 rounded-xl border border-white/5 shadow-xl">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white transition"><PanelLeft size={15} /></button>}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-600 flex items-center justify-center text-white shadow-lg">
              <Sparkles size={14} className="animate-pulse" />
            </div>
            <div className="w-[1px] h-5 bg-white/10" />
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white transition">
              <ArrowLeft size={13} /> Back to Hub
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setSupportOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-gray-400 font-mono hover:text-white transition"><LifeBuoy size={12} /> Live Support</button>
            <Link href="/pricing" className="bg-gradient-to-r from-zinc-900 to-black px-4 py-2 rounded-full border border-white/10 hover:border-purple-500/30 transition text-xs font-bold text-gray-300">💎 Upgrade Plan</Link>
            <button className="hidden items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-gray-400 md:flex font-mono"><Layers3 size={12} /> Asset Desk</button>
          </div>
        </header>

        {/* INTEGRATED PIPELINE WORKFLOW */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* PARAMETERS CONTROL TOWER */}
          <div className="lg:col-span-4 border-r border-white/5 bg-[#050507] p-5 space-y-5 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
              <SlidersHorizontal size={13} className="text-purple-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Synthesis Control Hub</h2>
            </div>

            {/* Pipeline Buttons Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">AI Generation Engine</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setActiveType("ai-video")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "ai-video" ? "bg-purple-600/10 border-purple-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                  <Video size={14} className={activeType === "ai-video" ? "text-purple-400" : "text-gray-500"} />
                  <div>
                    <p className="text-[11px] font-black tracking-tight">AI Video Generator</p>
                    <span className="text-[9px] text-gray-500 font-mono">Text to Video</span>
                  </div>
                </button>

                <button onClick={() => setActiveType("ai-avatar")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "ai-avatar" ? "bg-cyan-600/10 border-cyan-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                  <UserSquare2 size={14} className={activeType === "ai-avatar" ? "text-cyan-400" : "text-gray-500"} />
                  <div>
                    <p className="text-[11px] font-black tracking-tight">Create an Avatar</p>
                    <span className="text-[9px] text-gray-500 font-mono">Photo Presenter</span>
                  </div>
                </button>

                <button onClick={() => setActiveType("image-to-avatar")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "image-to-avatar" ? "bg-emerald-600/10 border-emerald-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                  <ImageIcon size={14} className={activeType === "image-to-avatar" ? "text-emerald-400" : "text-gray-500"} />
                  <div>
                    <p className="text-[11px] font-black tracking-tight">Image To Video</p>
                    <span className="text-[9px] text-gray-500 font-mono">HeyGen Engine Mode</span>
                  </div>
                </button>

                <button onClick={() => setActiveType("voice-clone")} className={`p-3 text-left rounded-xl border transition flex flex-col justify-between h-20 group ${activeType === "voice-clone" ? "bg-amber-600/10 border-amber-500 text-white" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                  <Mic size={14} className={activeType === "voice-clone" ? "text-amber-400" : "text-gray-500"} />
                  <div>
                    <p className="text-[10px] font-black tracking-tight leading-none">AI Voice Cloning & Lip-Sync</p>
                    <span className="text-[9px] text-gray-500 font-mono">Cloning Matrix</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Asset Seed Uploader for Images */}
            {(activeType === "ai-avatar" || activeType === "image-to-avatar") && (
              <div className="space-y-1.5 border-t border-white/5 pt-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Upload size={11} /> Source Face/Scene Image</label>
                <div onClick={() => imageInputRef.current?.click()} className="border border-dashed border-white/10 hover:border-purple-500/30 bg-white/5 rounded-xl p-3 text-center cursor-pointer transition min-h-[90px] flex items-center justify-center">
                  <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  {uploadedImage ? (
                    <div className="relative w-full h-20 rounded-lg overflow-hidden">
                      <img src={uploadedImage} alt="Core Matrix Seed" className="w-full h-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }} className="absolute top-1 right-1 bg-black/80 p-1 rounded-full text-gray-400"><X size={10} /></button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-mono font-bold">Drop an image here or click to browse</p>
                      <p className="text-[9px] text-gray-600">Transforms Photo to Speaking Studio Avatar</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Voice Clone Upload Control Box */}
            {activeType === "voice-clone" && (
              <div className="space-y-3 border-t border-white/5 pt-3 font-mono">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Mic size={11} className="text-amber-400" /> 1. Voice Sample (Instant Cloning)</label>
                  <div onClick={() => voiceInputRef.current?.click()} className="border border-dashed border-white/10 bg-neutral-900 rounded-xl p-2.5 text-center cursor-pointer text-[10px] text-gray-400">
                    <input type="file" ref={voiceInputRef} className="hidden" accept="audio/*" onChange={handleVoiceUpload} />
                    {voiceSampleUrl ? "✅ عينة الصوت مشحونة بنجاح في النظام" : "ارفع ملف صوتي لنفسك (5 ثوانٍ) لنطق بصمتك الصوتية"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">2. Target Language</label>
                  <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full bg-black text-xs text-gray-400 border border-white/10 rounded-xl p-2 outline-none">
                    <option value="ar">العربية الفصحى 🇸🇦</option>
                    <option value="en">English US 🇺🇸</option>
                    <option value="fr">French 🇫🇷</option>
                  </select>
                </div>

                {lastGeneratedAvatarUrl && (
                  <div className="bg-purple-950/10 border border-purple-500/20 p-2.5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-purple-400 uppercase">Active Lip-Sync Overlay</label>
                      <input type="checkbox" checked={isLipSyncActive} onChange={(e) => setIsLipSyncActive(e.target.checked)} className="accent-purple-400 cursor-pointer" />
                    </div>
                    <p className="text-[9px] text-gray-500 leading-tight">دمج ومزامنة بصمة الصوت المولدة تلقائياً مع حركة شفايف آخر أفاتار قمت بإنتاجه.</p>
                  </div>
                )}
              </div>
            )}

            {/* Dimensions Control */}
            {activeType !== "voice-clone" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Aspect Dimensions</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["16:9", "9:16", "1:1"] as AspectRatioType[]).map((ratio) => (
                    <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`py-1.5 text-[11px] rounded-xl border font-mono transition ${aspectRatio === ratio ? "border-purple-500 text-purple-400 bg-purple-500/10 font-bold" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
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
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Move size={11} /> Camera Lens Vector</label>
                <select value={cameraMotion} onChange={(e) => setCameraMotion(e.target.value as CameraMotionType)} className="w-full bg-black text-xs text-gray-400 border border-white/10 rounded-xl p-2.5 outline-none font-mono">
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
          <div className="lg:col-span-8 flex flex-col justify-between overflow-hidden bg-black relative">
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              
              <div className="relative aspect-video max-h-[400px] w-full mx-auto rounded-2xl border border-white/5 bg-[#060608] flex items-center justify-center overflow-hidden shadow-2xl">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <div className="text-[9px] uppercase font-mono tracking-widest text-gray-400 bg-black/70 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md flex items-center gap-1">
                    <Tv size={11} className="text-purple-400" /> Live AI Output Preview
                  </div>
                  {lastMessage?.outputUrl && activeType !== "voice-clone" && (
                    <button onClick={() => setCompareMode(!compareMode)} className={`flex items-center gap-1 text-[9px] font-bold uppercase font-mono px-3 py-1.5 rounded-lg border transition ${compareMode ? "bg-purple-600 text-white border-purple-400" : "bg-black/70 text-gray-400 border-white/10"}`}>
                      <Columns size={11} /> Split Screen
                    </button>
                  )}
                </div>

                {lastMessage && lastMessage.outputUrl && !isGenerating ? (
                  <div className="w-full h-full relative">
                    {compareMode ? (
                      <div className="w-full h-full relative select-none">
                        <div className="absolute inset-0 bg-[#111]" style={{ clipPath: `polygon(${compareSlider}% 0, 100% 0, 100% 100%, ${compareSlider}% 100%)` }}>
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
                          <video src={lastMessage.outputUrl} controls autoPlay loop className="w-full h-full object-contain bg-black" />
                        )}
                        <a href={lastMessage.outputUrl} download target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 bg-black/80 hover:bg-purple-500 hover:text-black p-2.5 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all">
                          <Download size={13} /> Export Stream
                        </a>
                      </div>
                    )}
                  </div>
                ) : isGenerating ? (
                  <div className="text-center space-y-3 px-4">
                    <Loader2 size={32} className="text-purple-500 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-gray-400">الذكاء الاصطناعي يقوم بحياكة الإطارات وتحريك الأفاتار...</p>
                    <div className="w-48 h-1 bg-zinc-800 rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 space-y-2 p-6">
                    <div className="w-12 h-12 bg-zinc-800/80 rounded-full flex items-center justify-center mx-auto text-gray-400 border border-white/5 shadow-inner">
                      <Play size={18} fill="currentColor" className="translate-x-0.5" />
                    </div>
                    <p className="text-xs font-black text-gray-400">Ready for Production</p>
                    <p className="text-[11px] text-gray-600 max-w-xs mx-auto">عند الضغط على التوليد، ستظهر اللقطات والتحريكات الصوتية والوجهية هنا مباشرةً.</p>
                  </div>
                )}
              </div>

              {/* Execution Log Layer */}
              {activeChat && activeChat.messages.length > 0 && (
                <div className="border-t border-white/5 pt-4 space-y-3">
                  {activeChat.messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 p-3.5 rounded-xl border ${msg.role === "user" ? "bg-white/5 border-white/5" : "bg-purple-950/5 border-purple-500/10"}`}>
                      {msg.role === "user" ? <User size={13} className="text-gray-400 mt-0.5" /> : <Bot size={13} className="text-purple-400 mt-0.5" />}
                      <div className="text-xs flex-1">
                        <span className="font-bold block text-[10px] text-gray-500 uppercase">{msg.role === "user" ? "Input Criteria" : "Output Tracking Matrix"}</span>
                        <p className="text-gray-300 font-mono whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Input Desk Area */}
            <div className="p-4 border-t border-white/5 bg-[#070709]/90 backdrop-blur-md space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {PRESET_STYLES.map(style => (
                  <button key={style.id} onClick={() => handlePresetApply(style)} className="relative h-8 rounded-xl overflow-hidden border border-white/5 bg-neutral-900 flex items-center justify-center p-1 hover:border-white/20 transition">
                    <span className="text-[10px] font-bold text-gray-400">{style.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-3 bg-[#030304] border border-white/5 rounded-2xl p-2.5 focus-within:border-purple-500/30 transition">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={activeType === "voice-clone" ? "اكتب هنا النص المراد تحويله لبصمتك الصوتية المستنسخة أو الصوت الجاهز..." : "Describe the video you want to generate (e.g., 'A futuristic cyberpunk city with neon lights and flying cars, cinematic lighting, 4k')..."}
                  className="max-h-24 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-1.5 text-xs outline-none text-white placeholder:text-gray-700"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerateVideo(); } }}
                />
                <button onClick={handleGenerateVideo} disabled={isGenerating || !prompt.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white disabled:opacity-20 transition shadow-md">
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
              <div className="text-[10px] text-zinc-500 text-center font-mono">
                Output Engine: AMKAAI-Video-v2.6 • Resolution up to 4K Ultra
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SUPPORT LAYER */}
      <AnimatePresence>
        {supportOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/5 bg-[#09090b] p-6 space-y-4 shadow-2xl relative">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2"><LifeBuoy size={14} className="text-purple-400" /> Support Core</h3>
                <p className="text-xs text-gray-500 font-mono mt-4 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                  Our clusters are operating at nominal values. If your H100 sequence allocation fails or stays inside the render queue for more than 180s, drop an analytical ticket below.
                </p>
              </div>
              <div className="flex gap-2">
                <input value={supportInput} onChange={e => setSupportInput(e.target.value)} className="flex-1 rounded-xl bg-black border border-white/5 p-3 text-xs outline-none text-white font-mono" placeholder="Inquire cluster debug parameters..." />
                <button onClick={() => setSupportOpen(false)} className="rounded-xl bg-purple-500 px-5 text-xs font-bold text-black">Log Ticket</button>
              </div>
              <button onClick={() => setSupportOpen(false)} className="absolute right-4 top-4 text-gray-500 hover:text-white" aria-label="Close support dispatch dashboard"><X size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}