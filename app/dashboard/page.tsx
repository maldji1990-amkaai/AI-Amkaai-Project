"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ImageIcon, Mic, Sparkles, UserSquare2, Video, Wand2 } from "lucide-react";

const tools = [
  { id: "ai-video", title: "AI Video Generator", subtitle: "Text to cinematic video", icon: Video },
  { id: "ai-avatar", title: "Create an Avatar", subtitle: "Turn a photo into a presenter", icon: UserSquare2 },
  { id: "image-to-video", title: "Image to Video", subtitle: "Animate your images", icon: ImageIcon },
  { id: "voice-clone", title: "AI Voice & Lip-Sync", subtitle: "Clone voice and sync speech", icon: Mic },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#f7fbfa] text-slate-900 font-sans">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16b8a6] text-white shadow-sm"><Sparkles size={17} /></span>
            <span>AMKAAI</span><span className="text-[#16a895]">STUDIO</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="hidden rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:block">Pricing</Link>
            <Link href="/dashboard/generate" className="rounded-xl bg-[#16b8a6] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#119e90]">Open Generator</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#bceee8] bg-[#eafff9] px-3 py-1.5 text-xs font-bold text-[#128f82]"><Wand2 size={13} /> AI CREATIVE WORKSPACE</div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">Create anything with <span className="text-[#12a995]">AI.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500 md:text-lg">Choose a generation engine, describe your idea, and let AMKAAI turn your prompt into cinematic content.</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <motion.div key={tool.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Link href="/dashboard/generate" className="group block h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-[#8cddd3] hover:shadow-[0_15px_40px_rgba(20,184,166,0.12)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9faf7] text-[#0fa493] transition group-hover:bg-[#16b8a6] group-hover:text-white"><Icon size={21} /></div>
                  <h2 className="mt-6 font-black text-slate-900">{tool.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{tool.subtitle}</p>
                  <div className="mt-6 flex items-center gap-1 text-xs font-bold text-[#109b8b]">Start creating <ArrowRight size={13} className="transition group-hover:translate-x-1" /></div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 rounded-3xl border border-[#bdece6] bg-gradient-to-r from-white to-[#edfffb] p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div><p className="text-xs font-black uppercase tracking-wider text-[#129d8d]">Production Studio</p><h2 className="mt-1 text-2xl font-black text-slate-950">One workspace for all four engines.</h2><p className="mt-2 text-sm text-slate-500">Generate, preview, monitor progress and export from one clean interface.</p></div>
            <Link href="/dashboard/generate" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#16b8a6] px-6 py-3.5 text-sm font-black text-white shadow-md hover:bg-[#119e90]">Launch Studio <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
