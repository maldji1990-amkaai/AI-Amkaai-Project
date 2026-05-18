import "./globals.css";

import type { Metadata } from "next";

import { ClerkProvider } from "@clerk/nextjs";

import { Geist } from "next/font/google";

import { cn } from "@/lib/utils";

import Providers from "./providers";

import { TooltipProvider } from "@/components/ui/tooltip";

//////////////////////////////////////////////////
// 🔤 FONT
//////////////////////////////////////////////////

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

//////////////////////////////////////////////////
// 🚀 SEO METADATA
//////////////////////////////////////////////////

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://www.amkaai.net"
  ),

  title: {
    default:
      "AMKAAI — Cinematic AI Platform",

    template: "%s | AMKAAI",
  },

  description:
    "Create cinematic AI videos, AI voices, images and premium generative content instantly with AMKAAI.",

  keywords: [
    "AI Video Generator",
    "AI Voice Generator",
    "AI Image Generator",
    "AI SaaS",
    "Cinematic AI",
    "Generative AI",
    "AMKAAI",
    "AI Content Creation",
    "Runway Alternative",
    "ElevenLabs Alternative",
  ],

  authors: [
    {
      name: "AMKAAI",
    },
  ],

  creator: "AMKAAI",

  publisher: "AMKAAI",

  applicationName: "AMKAAI",

  category: "technology",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    title:
      "AMKAAI — Cinematic AI Platform",

    description:
      "Generate AI videos, cinematic voices and premium content with futuristic AI workflows.",

    url: "https://www.amkaai.net",

    siteName: "AMKAAI",

    locale: "en_US",

    type: "website",

    images: [
      {
        url: "/og.png",

        width: 1200,

        height: 630,

        alt: "AMKAAI AI Platform",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title:
      "AMKAAI — Cinematic AI Platform",

    description:
      "Create cinematic AI content instantly with AMKAAI.",

    images: ["/og.png"],

    creator: "@amkaai",
  },

  icons: {
    icon: "/favicon.ico",

    shortcut: "/favicon.ico",

    apple: "/apple-touch-icon.png",
  },

  alternates: {
    canonical:
      "https://www.amkaai.net",
  },

  themeColor: "#000000",
};

//////////////////////////////////////////////////
// ROOT LAYOUT
//////////////////////////////////////////////////

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>

      <html
        lang="en"
        suppressHydrationWarning
        className={cn(
          "dark scroll-smooth",
          geist.variable
        )}
      >

        <body
          className={cn(
            "min-h-screen bg-black font-sans antialiased text-white overflow-x-hidden"
          )}
        >

          {/* 🌌 GLOBAL BACKGROUND */}
          <div className="fixed inset-0 -z-50 bg-black" />

          {/* ✨ CYAN GLOW */}
          <div className="pointer-events-none fixed left-1/2 top-0 -z-40 h-[550px] w-[1000px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

          {/* 🌈 PURPLE GLOW */}
          <div className="pointer-events-none fixed bottom-0 left-1/2 -z-40 h-[550px] w-[1000px] -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />

          {/* 🧠 GRID EFFECT */}
          <div
            className="pointer-events-none fixed inset-0 -z-30 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize:
                "80px 80px",
            }}
          />

          {/* 🚀 APP */}
          <TooltipProvider>

            <Providers>

              <div className="relative min-h-screen">
                {children}
              </div>

            </Providers>

          </TooltipProvider>

        </body>
      </html>

    </ClerkProvider>
  );
}