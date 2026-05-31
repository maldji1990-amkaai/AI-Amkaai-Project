"use client";

import { useUser } from "@clerk/nextjs";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  Send,
  Plus,
  LifeBuoy,
  X,
  Crown,
  Settings,
  Bot,
  User,
  Zap,
  BarChart3,
  CreditCard,
  PanelLeft,
  Sparkles,
  Trash2,
  Wand2,
  Clock3,
  ImageIcon,
  Video,
  Mic,
} from "lucide-react";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

////////////////////////////////////////////////////////////
// TYPES
////////////////////////////////////////////////////////////

type Role = "user" | "admin" | "agent";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

type SupportMessage = {
  id: string;
  from: "user" | "support";
  content: string;
  createdAt: number;
};

type Ticket = {
  id: string;
  title: string;
  status: "open" | "pending" | "closed";
  messages: SupportMessage[];
  createdAt: number;
};

////////////////////////////////////////////////////////////
// AI ENGINE
////////////////////////////////////////////////////////////

function aiEngine(prompt: string) {
  const p = prompt.toLowerCase();

  // VIDEO
  if (
    p.includes("video") ||
    p.includes("cinematic") ||
    p.includes("movie")
  ) {
    return `
🎬 CINEMATIC VIDEO GENERATED

Prompt:
${prompt}

━━━━━━━━━━━━━━━━━━

✓ 4K Ultra HD
✓ AI Motion Engine
✓ Dynamic Camera
✓ Hyper Realistic Lighting
✓ Professional Cinematic Style
✓ Kling / Runway Inspired

Rendering Status:
████████████░░ 82%

Estimated Time:
12 seconds
`;
  }

  // IMAGE
  if (
    p.includes("image") ||
    p.includes("photo") ||
    p.includes("picture") ||
    p.includes("art")
  ) {
    return `
🖼️ AI IMAGE GENERATED

Prompt:
${prompt}

━━━━━━━━━━━━━━━━━━

✓ 8K Resolution
✓ Ultra Detailed
✓ Cinematic Composition
✓ AI Color Grading
✓ Professional Lighting
✓ Photorealistic Rendering
`;
  }

  // LOGO
  if (p.includes("logo")) {
    return `
🎨 BRAND LOGO GENERATED

${prompt}

━━━━━━━━━━━━━━━━━━

✓ Luxury Branding
✓ Modern Typography
✓ AI Vector Style
✓ Startup Ready
✓ SaaS Identity Package
`;
  }

  // WEBSITE
  if (
    p.includes("website") ||
    p.includes("landing page") ||
    p.includes("saas")
  ) {
    return `
🌐 WEBSITE GENERATED

${prompt}

━━━━━━━━━━━━━━━━━━

Sections Included:

✓ Hero Section
✓ Features
✓ Pricing
✓ Testimonials
✓ FAQ
✓ CTA
✓ Dashboard UI
`;
  }

  // VOICE
  if (
    p.includes("voice") ||
    p.includes("audio") ||
    p.includes("speech")
  ) {
    return `
🎤 AI VOICE GENERATED

${prompt}

━━━━━━━━━━━━━━━━━━

✓ Human Voice
✓ AI Enhancement
✓ Studio Quality
✓ Noise Cleanup
✓ Voice Emotion Engine
`;
  }

  // DEFAULT
  return `
🧠 LEVEL 9 AI RESPONSE

${prompt}

━━━━━━━━━━━━━━━━━━

AMKAAI processed your request successfully.
`;
}

////////////////////////////////////////////////////////////
// SUPPORT AI
////////////////////////////////////////////////////////////

function supportAI(text: string) {
  const t = text.toLowerCase();

  if (t.includes("refund")) {
    return "Refund request received. Processing within 24 hours.";
  }

  if (
    t.includes("bug") ||
    t.includes("error")
  ) {
    return "Bug report escalated to engineering team.";
  }

  if (t.includes("urgent")) {
    return "High priority ticket detected.";
  }

  return "Support request received successfully.";
}

////////////////////////////////////////////////////////////
// MAIN PAGE
////////////////////////////////////////////////////////////

function detectType(text: string) {
  const t = text.toLowerCase();

  if (
    t.includes("image") ||
    t.includes("photo") ||
    t.includes("picture") ||
    t.includes("wallpaper") ||
    t.includes("art") ||
    t.includes("draw") ||
    t.includes("design")
  ) {
    return "image";
  }

  if (
    t.includes("video") ||
    t.includes("movie") ||
    t.includes("cinematic") ||
    t.includes("animation") ||
    t.includes("trailer")
  ) {
    return "video";
  }

  if (
    t.includes("voice") ||
    t.includes("audio") ||
    t.includes("speech") ||
    t.includes("talk")
  ) {
    return "voice";
  }

  return "text";
}

export default function DashboardPage() {
  const { user } = useUser();

  const role: Role =
    (user?.publicMetadata?.role as Role) ||
    "user";

  const plan = "PRO";

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const [input, setInput] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [credits, setCredits] =
    useState(100);

  const [chats, setChats] = useState<
    Chat[]
  >([]);

  const [activeChatId, setActiveChatId] =
    useState<string | null>(null);

  const [tickets, setTickets] = useState<
    Ticket[]
  >([]);

  const [supportOpen, setSupportOpen] =
    useState(false);

  const [supportInput, setSupportInput] =
    useState("");

  const [activeTicketId, setActiveTicketId] =
    useState<string | null>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  ////////////////////////////////////////////////////////////
  // INIT
  ////////////////////////////////////////////////////////////

  useEffect(() => {
    if (!chats.length) {
      createChat();
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chats, loading]);

  const activeChat = useMemo(() => {
    return chats.find(
      (c) => c.id === activeChatId
    );
  }, [chats, activeChatId]);

  const activeTicket = useMemo(() => {
    return tickets.find(
      (t) => t.id === activeTicketId
    );
  }, [tickets, activeTicketId]);
const lastMessage =
  activeChat?.messages[
    (activeChat.messages.length || 1) - 1
  ];

  ////////////////////////////////////////////////////////////
  // CHAT
  ////////////////////////////////////////////////////////////

  const createChat = () => {
    const chat: Chat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      createdAt: Date.now(),
      messages: [],
    };

    setChats((prev) => [chat, ...prev]);

    setActiveChatId(chat.id);
  };

  const deleteChat = (id: string) => {
    const filtered = chats.filter(
      (c) => c.id !== id
    );

    setChats(filtered);

    if (activeChatId === id) {
      setActiveChatId(
        filtered[0]?.id || null
      );
    }
  };

  ////////////////////////////////////////////////////////////
  // QUICK PROMPTS
  ////////////////////////////////////////////////////////////

  const quickGenerate = (type: string) => {
    let generatedPrompt = "";

    if (type === "image") {
      generatedPrompt =
        "Generate ultra realistic futuristic AI image";
    }

    if (type === "video") {
      generatedPrompt =
        "Generate cinematic sci-fi AI video";
    }

    if (type === "voice") {
      generatedPrompt =
        "Generate realistic human AI voice";
    }

    if (type === "analytics") {
      generatedPrompt =
        "Generate SaaS analytics dashboard";
    }

    setInput(generatedPrompt);

    setTimeout(() => {
      sendMessage(generatedPrompt);
    }, 200);
  };

  ////////////////////////////////////////////////////////////
  // SEND MESSAGE
  ////////////////////////////////////////////////////////////

const sendMessage = async (customPrompt?: string) => {
  const finalPrompt = customPrompt || input;

  if (!finalPrompt.trim()) return;
  if (!activeChat) return;

  const aiType = detectType(finalPrompt);

  const msg: Message = {
    role: "user",
    content: finalPrompt,
  };

  setChats((prev) =>
    prev.map((c) =>
      c.id === activeChatId
        ? {
            ...c,
            title:
              c.messages.length === 0
                ? finalPrompt.slice(0, 30)
                : c.title,
            messages: [...c.messages, msg],
          }
        : c
    )
  );

  setInput("");
  setLoading(true);

  try {
let endpoint = "/api/ai";
let bodyData: any = {};

// 🎯 تحديد النوع
if (aiType === "image") {
  endpoint = "/api/generate-image";
  bodyData = { prompt: finalPrompt };
}

if (aiType === "video") {
  endpoint = "/api/generate-video";
  bodyData = { prompt: finalPrompt };
}

if (aiType === "voice") {
  endpoint = "/api/generate-voice";
  bodyData = { text: finalPrompt };
}

// 🚀 إرسال الطلب الحقيقي
const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(bodyData),
});

    const data = await res.json();

 let content = "";

// 🧠 DEMO MODE (FREE USERS)
if (data.demo) {
  if (data.image) {
    content = `🖼️ DEMO IMAGE:\n${data.image}`;
  }

  else if (data.video) {
    content = `🎬 DEMO VIDEO:\n${data.video}`;
  }

  else if (data.audio) {
    content = `🎤 DEMO VOICE:\n${data.audio}`;
  }
}

// ⏳ JOB SYSTEM (PRO USERS)
else if (data.jobId) {
  content = `⏳ Processing...\nJob ID: ${data.jobId}`;
}

// ❌ ERROR
else if (data.error) {
  content = `❌ ${data.error}`;
}

// fallback
else {
  content = aiEngine(finalPrompt);
}

const reply: Message = {
  role: "assistant",
  content,
};   

    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              messages: [
                ...c.messages,
                reply,
              ],
            }
          : c
      )
    );

    setCredits((c) => c - 1);
  } catch (error) {
    console.error(error);

    const reply: Message = {
      role: "assistant",
      content:
        aiEngine(finalPrompt),
    };

    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              messages: [
                ...c.messages,
                reply,
              ],
            }
          : c
      )
    );
  } finally {
    setLoading(false);
  }
};

  ////////////////////////////////////////////////////////////
  // SUPPORT
  ////////////////////////////////////////////////////////////

  const createTicket = () => {
    const ticket: Ticket = {
      id: crypto.randomUUID(),
      title: "Support Ticket",
      status: "open",
      createdAt: Date.now(),
      messages: [],
    };

    setTickets((prev) => [
      ticket,
      ...prev,
    ]);

    setActiveTicketId(ticket.id);
  };

  const sendSupport = () => {
    if (!supportInput.trim()) return;

    if (!activeTicket) return;

    const msg: SupportMessage = {
      id: crypto.randomUUID(),
      from: "user",
      content: supportInput,
      createdAt: Date.now(),
    };

    setTickets((prev) =>
      prev.map((t) =>
        t.id === activeTicketId
          ? {
              ...t,
              status: "pending",
              messages: [
                ...t.messages,
                msg,
              ],
            }
          : t
      )
    );

    setSupportInput("");

    setTimeout(() => {
      const reply: SupportMessage = {
        id: crypto.randomUUID(),
        from: "support",
        content: supportAI(
          msg.content
        ),
        createdAt: Date.now(),
      };

      setTickets((prev) =>
        prev.map((t) =>
          t.id === activeTicketId
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  reply,
                ],
              }
            : t
        )
      );
    }, 1000);
  };

  ////////////////////////////////////////////////////////////
  // STATS
  ////////////////////////////////////////////////////////////

  const stats = {
    users: 1284,
    tickets: tickets.length,
    open: tickets.filter(
      (t) => t.status === "open"
    ).length,
  };

  ////////////////////////////////////////////////////////////
  // UI
  ////////////////////////////////////////////////////////////

  return (
    <main className="flex h-screen overflow-hidden bg-black text-white">
      {/* SIDEBAR */}

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{
              x: -300,
              opacity: 0,
            }}
            animate={{
              x: 0,
              opacity: 1,
            }}
            exit={{
              x: -300,
              opacity: 0,
            }}
            className="w-80 border-r border-white/10 bg-white/5 backdrop-blur-2xl"
          >
            <div className="border-b border-white/10 p-5">
              <div className="mb-5 flex items-center justify-between">
                <Link
                  href="/"
                  className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-2xl font-black text-transparent"
                >
                  AMKAAI
                </Link>

                <button
                  onClick={() =>
                    setSidebarOpen(false)
                  }
                >
                  <PanelLeft />
                </button>
              </div>

              <button
                onClick={createChat}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-bold text-black"
              >
                <Plus size={18} />
                New Chat
              </button>
            </div>

            <div className="space-y-2 p-4">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() =>
                    setActiveChatId(
                      chat.id
                    )
                  }
                  className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <div>
                    <p>{chat.title}</p>

                    <p className="text-xs text-gray-500">
                      {
                        chat.messages.length
                      }{" "}
                      messages
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                  >
                    <Trash2
                      size={16}
                      className="text-red-400"
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 p-5">
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                <div className="flex items-center gap-2">
                  <Crown className="text-cyan-400" />

                  <p className="font-bold">
                    {plan}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span>Credits</span>

                  <span className="font-bold text-cyan-400">
                    {credits}
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MAIN */}

      <section className="flex flex-1 flex-col overflow-hidden">
        {/* TOPBAR */}

        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() =>
                  setSidebarOpen(true)
                }
              >
                <PanelLeft />
              </button>
            )}

            <div>
              <h1 className="text-xl font-bold">
                Level 9 SaaS
              </h1>

              <p className="text-sm text-gray-500">
                Production AI Dashboard
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <TopButton
              icon={<Zap size={16} />}
              label="Generate"
            />

            <TopButton
              icon={
                <BarChart3 size={16} />
              }
              label="Analytics"
            />

            <TopButton
              icon={
                <CreditCard size={16} />
              }
              label="Billing"
            />

            <TopButton
              icon={
                <Settings size={16} />
              }
              label="Settings"
            />
          </div>
        </header>

        {/* HERO */}

        <div className="border-b border-white/10 px-6 py-8">
          <div className="mx-auto max-w-5xl">
            <button
              onClick={() =>
                quickGenerate("video")
              }
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-bold text-black"
            >
              Generate AI Prompt
            </button>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="text-xl text-gray-300 whitespace-pre-wrap">
  {lastMessage?.role === "assistant"
    ? lastMessage.content
    : "AI generated cinematic output appears here..."}
</div>
            </div>

            {/* CARDS */}

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-4">
              <FeatureCard
                icon={<ImageIcon />}
                title="AI Images"
                text="Generate stunning visuals instantly."
                onClick={() =>
                  quickGenerate("image")
                }
              />

              <FeatureCard
                icon={<Mic />}
                title="AI Voices"
                text="Realistic human voice generation."
                onClick={() =>
                  quickGenerate("voice")
                }
              />

              <FeatureCard
                icon={<Video />}
                title="AI Videos"
                text="Cinematic video creation with AI."
                onClick={() =>
                  quickGenerate("video")
                }
              />

              <FeatureCard
                icon={<BarChart3 />}
                title="Analytics"
                text="Track your AI generation usage."
                onClick={() =>
                  quickGenerate(
                    "analytics"
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* CHAT */}

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-4xl space-y-8">
            {activeChat?.messages.map(
              (msg, i) => (
                <motion.div
                  key={i}
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className={`flex ${
                    msg.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-2xl gap-4 rounded-3xl border p-5 ${
                      msg.role ===
                      "user"
                        ? "border-cyan-400/20 bg-cyan-400/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div>
                      {msg.role ===
                      "assistant" ? (
                        <Wand2 className="text-cyan-400" />
                      ) : (
                        <User />
                      )}
                    </div>

                    <div>
                      <div className="whitespace-pre-wrap leading-relaxed">
  {msg.content}
</div>
                      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                        <Clock3 size={12} />
                        Just now
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
                  <Bot className="text-cyan-400" />

                  <div className="flex gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* INPUT */}

        <div className="border-t border-white/10 p-5">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-end gap-4 rounded-3xl border border-white/10 bg-white/5 p-3">
              <textarea
                value={input}
                onChange={(e) =>
                  setInput(
                    e.target.value
                  )
                }
                placeholder="Ask AMKAAI to generate cinematic AI content..."
                className="max-h-40 min-h-[56px] flex-1 resize-none bg-transparent px-3 py-3 outline-none"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />

              <button
                onClick={() =>
                  sendMessage()
                }
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-black"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SUPPORT BUTTON */}

      <button
        onClick={() =>
          setSupportOpen(true)
        }
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-3 text-black"
      >
        <LifeBuoy size={18} />
        Support
      </button>

      {/* SUPPORT MODAL */}

      <AnimatePresence>
        {supportOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="relative flex h-[600px] w-[900px] rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl">
              <div className="w-1/3 border-r border-white/10 p-3">
                <button
                  onClick={createTicket}
                  className="mb-3 w-full rounded bg-cyan-400 p-2 text-black"
                >
                  + New Ticket
                </button>

                {tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() =>
                      setActiveTicketId(
                        t.id
                      )
                    }
                    className="cursor-pointer rounded p-2 hover:bg-white/10"
                  >
                    <p>{t.title}</p>

                    <p className="text-xs text-gray-500">
                      {t.status}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-1 flex-col p-3">
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {activeTicket?.messages.map(
                    (m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl p-3 text-sm ${
                          m.from ===
                          "user"
                            ? "ml-auto bg-cyan-400 text-black"
                            : "bg-white/10"
                        }`}
                      >
                        {m.content}
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={supportInput}
                    onChange={(e) =>
                      setSupportInput(
                        e.target.value
                      )
                    }
                    className="flex-1 rounded-xl bg-black/40 p-3"
                    placeholder="Describe your issue..."
                  />

                  <button
                    onClick={sendSupport}
                    className="rounded-xl bg-cyan-400 px-4 text-black"
                  >
                    Send
                  </button>
                </div>
              </div>

              <button
                onClick={() =>
                  setSupportOpen(false)
                }
                className="absolute right-3 top-3"
              >
                <X />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

////////////////////////////////////////////////////////////
// FEATURE CARD
////////////////////////////////////////////////////////////

function FeatureCard({
  icon,
  title,
  text,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-3xl border border-white/10 bg-white/5 p-8 text-left transition hover:scale-[1.02] hover:bg-white/10"
    >
      <div className="mb-4 text-cyan-400">
        {icon}
      </div>

      <h3 className="text-2xl font-bold">
        {title}
      </h3>

      <p className="mt-3 text-gray-400">
        {text}
      </p>
    </button>
  );
}

////////////////////////////////////////////////////////////
// TOP BUTTON
////////////////////////////////////////////////////////////

function TopButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10 md:flex">
      {icon}
      {label}
    </button>
  );
}