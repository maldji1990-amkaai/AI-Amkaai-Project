"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck } from "lucide-react";

export default function SignInPage() {
  return (
    <main className="relative min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-6 font-sans select-none">
      
      {/* 🌌 BACKGROUND MATRIX GRID & BLUR OVALS */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#141416_1px,transparent_1px),linear-gradient(to_bottom,#141416_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-gradient-to-tr from-cyan-500/5 to-indigo-500/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />

      {/* BRAND INTERFACE CONTAINER */}
      <div className="w-full max-w-md z-10 flex flex-col items-center">
        
        {/* TOP BRAND LOGO SUB-BAR */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            <Sparkles className="text-cyan-400 animate-pulse" size={18} />
            AMKAAI
          </Link>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase tracking-widest">System Access Authorization Node</p>
        </motion.div>

        {/* CLERK COMPONENT WITH SYNCED FUTURISTIC THEME */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full"
        >
          <SignIn 
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
            appearance={{
              variables: {
                colorPrimary: "#06b6d4", // Cyan accent color
                colorBackground: "#070709", // Pure deep dark studio matching background
                colorText: "#ffffff",
                colorTextSecondary: "#a1a1aa",
                colorInputBackground: "rgba(0, 0, 0, 0.4)",
                colorInputText: "#ffffff",
                borderRadius: "12px",
              },
              elements: {
                rootBox: "w-full shadow-2xl",
                cardBox: "border border-white/5 bg-[#070709]/90 backdrop-blur-3xl p-6 rounded-3xl",
                headerTitle: "text-lg font-black tracking-tight text-white font-sans",
                headerSubtitle: "text-xs font-mono text-zinc-500",
                formButtonPrimary: "bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-black text-xs uppercase tracking-wider py-2.5 transition hover:opacity-90 shadow-[0_0_20px_rgba(6,182,212,0.15)] rounded-xl border-0",
                formFieldLabel: "text-[10px] font-black font-mono uppercase tracking-wider text-zinc-400 mb-1",
                formFieldInput: "border border-white/5 bg-black/40 text-xs rounded-xl focus:border-cyan-500/40 text-white font-mono placeholder:text-zinc-800",
                footerActionText: "text-[11px] text-zinc-500 font-sans",
                footerActionLink: "text-cyan-400 hover:text-cyan-300 font-bold text-[11px]",
                dividerLine: "bg-white/5",
                dividerText: "text-[10px] font-mono uppercase tracking-wider text-zinc-600",
                socialButtonsBlockButton: "border border-white/5 bg-white/5 rounded-xl text-xs font-mono font-bold text-zinc-300 hover:bg-white/10 transition",
                socialButtonsBlockButtonText: "text-zinc-300 font-bold",
              }
            }}
          />
        </motion.div>

        {/* BOTTOM SECURITY STAMP */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex items-center justify-center gap-1.5 text-[9px] font-mono text-zinc-600"
        >
          <ShieldCheck size={11} className="text-cyan-500/50" /> Secure Encryption via Clerk Global Auth Cluster
        </motion.div>

      </div>
    </main>
  );
}