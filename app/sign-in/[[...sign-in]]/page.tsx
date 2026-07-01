"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck } from "lucide-react";

export default function SignInPage() {
  return (
    <main
      className="relative min-h-screen text-white flex flex-col items-center justify-center p-4 font-sans"
      style={{ backgroundColor: "#030303" }}
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(6,182,212,0.07) 0%, transparent 100%)",
        }}
      />

      <div className="w-full max-w-md z-10 flex flex-col items-center">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent"
          >
            <Sparkles className="text-cyan-400" size={18} />
            AMKAAI
          </Link>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase tracking-widest">
            System Access Authorization Node
          </p>
        </motion.div>

        <div className="w-full">
          <SignIn
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
            appearance={{
              variables: {
                colorPrimary: "#06b6d4",
                colorBackground: "#0a0a0f",
                colorText: "#ffffff",
                colorTextSecondary: "#a1a1aa",
                colorInputBackground: "#111116",
                colorInputText: "#ffffff",
                borderRadius: "12px",
                fontFamily: "inherit",
              },
              elements: {
                rootBox: "w-full",
                cardBox: "w-full border border-white/10 rounded-2xl shadow-2xl",
                card: "bg-[#0a0a0f] p-6",
                headerTitle: "text-lg font-black tracking-tight text-white",
                headerSubtitle: "text-xs text-zinc-500",
                formButtonPrimary:
                  "bg-gradient-to-r from-cyan-500 to-indigo-500 !text-black font-black text-xs uppercase tracking-wider !py-3 hover:opacity-90 transition rounded-xl border-0 shadow-lg",
                formFieldLabel:
                  "text-[10px] font-bold uppercase tracking-wider text-zinc-400",
                formFieldInput:
                  "bg-black/60 border border-white/10 text-white text-sm rounded-xl focus:border-cyan-500/50 focus:ring-0 placeholder:text-zinc-700",
                footerActionText: "text-xs text-zinc-500",
                footerActionLink:
                  "text-cyan-400 hover:text-cyan-300 font-bold text-xs",
                dividerLine: "bg-white/10",
                dividerText: "text-[10px] uppercase tracking-wider text-zinc-600",
                socialButtonsBlockButton:
                  "border border-white/10 bg-white/5 rounded-xl text-xs font-bold text-zinc-300 hover:bg-white/10 transition",
                socialButtonsBlockButtonText: "text-zinc-300 font-bold",
                identityPreviewText: "text-white text-xs",
                identityPreviewEditButton: "text-cyan-400 text-xs",
                formResendCodeLink: "text-cyan-400 hover:text-cyan-300",
                otpCodeFieldInput:
                  "bg-black/60 border border-white/10 text-white rounded-xl text-lg font-bold",
                alertText: "text-xs",
              },
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex items-center justify-center gap-1.5 text-[9px] font-mono text-zinc-600"
        >
          <ShieldCheck size={11} className="text-cyan-500/50" />
          Secure Encryption via Clerk Global Auth Cluster
        </motion.div>
      </div>
    </main>
  );
}
