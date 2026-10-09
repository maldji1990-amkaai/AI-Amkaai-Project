"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Cpu, Film, Loader2, UploadCloud, Hourglass } from "lucide-react";

export type VideoProgressStatus =
  | "queued"
  | "processing"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

export type VideoProgressProps = {
  status: VideoProgressStatus;
  /** 0-100, as stored on the VideoJob */
  progress: number;
  /** PREPARING | GENERATING | DECODING | ENCODING | UPLOADING (sent by the GPU worker) */
  stage?: string | null;
  clip?: number | null;
  clipCount?: number | null;
  step?: number | null;
  totalSteps?: number | null;
  startedAt?: string | null;
  createdAt?: string | null;
  /** Stable id of the job; resets the ETA estimator when it changes */
  jobKey?: string;
  variant?: "full" | "compact";
};

const PHASES = [
  { key: "queue", label: "Queue", icon: Clock },
  { key: "gpu", label: "GPU", icon: Cpu },
  { key: "render", label: "Render", icon: Film },
  { key: "encode", label: "Encode", icon: Film },
  { key: "upload", label: "Upload", icon: UploadCloud },
] as const;

function phaseIndex(status: VideoProgressStatus, stage?: string | null): number {
  if (status === "completed") return PHASES.length;
  if (status === "queued") return 0;
  if (status === "finalizing") return 4;
  switch ((stage || "").toUpperCase()) {
    case "UPLOADING": return 4;
    case "ENCODING": return 3;
    case "GENERATING":
    case "DECODING": return 2;
    default: return 1;
  }
}

function describe(p: VideoProgressProps, phase: number) {
  const stage = (p.stage || "").toUpperCase();
  const clipTxt = p.clip && p.clipCount && p.clipCount > 1 ? ` · clip ${p.clip}/${p.clipCount}` : "";
  if (p.status === "completed") return { title: "Completed", detail: "Your video is ready." };
  if (p.status === "failed") return { title: "Failed", detail: "The generation did not complete." };
  if (p.status === "cancelled") return { title: "Cancelled", detail: "The job was cancelled." };
  if (p.status === "queued") return { title: "Waiting in queue", detail: "Your job is queued for a GPU." };
  if (p.status === "finalizing") return { title: "Finalizing your video", detail: "Merging and publishing the result." };
  if (stage === "GENERATING") {
    const stepTxt = typeof p.step === "number" && typeof p.totalSteps === "number"
      ? `Step ${p.step}/${p.totalSteps}` : "Sampling frames";
    return { title: `Rendering${clipTxt}`, detail: stepTxt };
  }
  if (stage === "DECODING") return { title: `Decoding frames${clipTxt}`, detail: "Converting latents to video frames." };
  if (stage === "ENCODING") return { title: "Encoding video", detail: "Writing and merging MP4 clips." };
  if (stage === "UPLOADING") return { title: "Uploading", detail: "Publishing your video." };
  if (stage === "PREPARING") return { title: "Preparing", detail: "Loading prompt and inputs." };
  return { title: phase <= 1 ? "Starting GPU worker" : "Processing", detail: "A cold start can take 1–3 minutes the first time." };
}

function fmt(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
}

export default function VideoProgress(props: VideoProgressProps) {
  const { status, progress, stage, startedAt, createdAt, jobKey, variant = "full" } = props;
  const done = status === "completed";
  const failed = status === "failed" || status === "cancelled";
  const active = status === "queued" || status === "processing" || status === "finalizing";
  const target = done ? 100 : Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const phase = phaseIndex(status, stage);

  // Smooth the real RunPod-backed value; never invent extra percentage points.
  const [shown, setShown] = useState(target);
  const lastJob = useRef<string | undefined>(jobKey);
  useEffect(() => {
    if (lastJob.current !== jobKey) {
      lastJob.current = jobKey;
      setShown(target);
    }
  }, [jobKey, target]);
  useEffect(() => {
    if (!active && !done) {
      setShown(target);
      return;
    }
    const id = window.setInterval(() => {
      setShown((cur) => {
        const next = cur + (target - cur) * 0.22;
        return Math.abs(target - next) < 0.15 ? target : next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [target, active, done]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const samples = useRef<{ key?: string; pts: { t: number; p: number }[]; lastChange: number }>({
    key: jobKey, pts: [], lastChange: Date.now(),
  });
  useEffect(() => {
    const s = samples.current;
    if (s.key !== jobKey) {
      s.key = jobKey;
      s.pts = [];
      s.lastChange = Date.now();
    }
    const last = s.pts[s.pts.length - 1];
    if (!last || last.p !== target) {
      s.lastChange = Date.now();
      if (status === "processing" && (stage || "").toUpperCase() === "GENERATING") {
        s.pts.push({ t: Date.now(), p: target });
        if (s.pts.length > 40) s.pts.shift();
      }
    }
  }, [target, stage, status, jobKey]);

  const startMs = Date.parse(startedAt || createdAt || "") || null;
  const elapsed = startMs && active ? (now - startMs) / 1000 : null;
  let eta: number | null = null;
  const pts = samples.current.pts;
  if (status === "processing" && (stage || "").toUpperCase() === "GENERATING" && pts.length >= 3) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt >= 8 && b.p > a.p) eta = Math.max(0, (90 - b.p) / ((b.p - a.p) / dt));
  }
  const stalledFor = active && status !== "queued" ? (now - samples.current.lastChange) / 1000 : 0;
  const stalled = stalledFor > 120;
  const { title, detail } = describe(props, phase);
  const pct = Math.round(Math.min(100, shown));
  const ringRadius = 133;
  const circumference = 2 * Math.PI * ringRadius;
  const ringOffset = circumference * (1 - Math.max(0, Math.min(100, shown)) / 100);
  const ringColor = failed ? "#ef4444" : done ? "#10b981" : "url(#amkaaiProgressGradient)";

  const bar = (h: string) => (
    <div className={`w-full ${h} overflow-hidden rounded-full bg-slate-200`} role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${failed ? "bg-red-500" : done ? "bg-emerald-500" : "bg-gradient-to-r from-sky-400 to-indigo-500"}`} style={{ width: `${Math.max(active ? 2 : 0, Math.min(100, shown))}%` }} />
    </div>
  );

  if (variant === "compact") {
    const short = status === "queued" ? "QUEUED" : done ? "DONE" : failed ? status.toUpperCase()
      : (stage || "").toUpperCase() === "GENERATING" && typeof props.step === "number" && typeof props.totalSteps === "number"
        ? `${props.step}/${props.totalSteps}` : title.toUpperCase();
    return <div className="space-y-1"><div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500"><span className="truncate">{short}</span><span className="shrink-0 tabular-nums text-indigo-600">{status === "queued" ? "" : `${pct}%`}</span></div>{bar("h-1")}</div>;
  }

  const ringLabels = [
    { text: "0%", x: 188, y: 42 },
    { text: "25%", x: 300, y: 82 },
    { text: "50%", x: 382, y: 162 },
    { text: "75%", x: 384, y: 278 },
    { text: "100%", x: 302, y: 365 },
  ];

  return (
    <div className="w-full text-center">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-slate-50 to-white px-4 py-7 shadow-[0_12px_45px_rgba(37,99,235,0.10)] sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.10),transparent_45%)]" />
        <div className="relative z-10">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">AMKA AI VIDEO GENERATOR</div>
          <div className="relative mx-auto mb-4 aspect-square w-full max-w-[370px]">
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 400 400" role="img" aria-label={`Video generation progress ${pct}%`}>
              <defs>
                <linearGradient id="amkaaiProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#63d7f2" />
                  <stop offset="52%" stopColor="#4388e8" />
                  <stop offset="100%" stopColor="#5543c7" />
                </linearGradient>
                <filter id="amkaaiRingGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle cx="200" cy="200" r={ringRadius} fill="none" stroke="#dbeafe" strokeWidth="11" />
              <circle cx="200" cy="200" r={ringRadius} fill="none" stroke={ringColor} strokeWidth="11" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={ringOffset} transform="rotate(-90 200 200)" filter="url(#amkaaiRingGlow)" className="transition-[stroke-dashoffset] duration-500 ease-out" />
              {ringLabels.map((label) => <text key={label.text} x={label.x} y={label.y} textAnchor="middle" fontSize="13" fill="#64748b" fontWeight="600">{label.text}</text>)}
            </svg>
            <div className="absolute inset-[18%] flex flex-col items-center justify-center overflow-hidden rounded-full bg-white shadow-[inset_0_0_28px_rgba(148,163,184,0.10)]">
              <img src="/amkaai-progress-logo.jpg" alt="AMKA AI — Powered by AI" className="h-full w-full object-contain" />
            </div>
            <div className="absolute bottom-[13%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-bold tabular-nums text-slate-700 shadow-sm" aria-live="polite">{pct}%</div>
          </div>

          <div className="mx-auto mb-5 max-w-md">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700">{title}</span>
              <span className={`font-bold tabular-nums ${failed ? "text-red-600" : done ? "text-emerald-600" : "text-indigo-600"}`}>{pct}%</span>
            </div>
            {bar("h-2")}
            <p className="mt-3 text-xs text-slate-500">{detail}</p>
          </div>

          <ol className="mx-auto mb-5 grid max-w-md grid-cols-5 gap-1">
            {PHASES.map((ph, i) => {
              const complete = done || i < phase;
              const current = !done && i === phase && active;
              const Icon = ph.icon;
              return <li key={ph.key} className="flex min-w-0 flex-col items-center gap-1.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] transition-all duration-300 ${complete ? "border-indigo-500 bg-indigo-500 text-white" : current ? "border-sky-400 bg-sky-50 text-sky-600 animate-pulse" : "border-slate-200 bg-white text-slate-400"}`}>
                  {complete ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
                </span>
                <span className={`truncate text-[8px] font-bold uppercase tracking-wider ${complete || current ? "text-indigo-600" : "text-slate-400"}`}>{ph.label}</span>
              </li>;
            })}
          </ol>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-center gap-2">
              {active && <Loader2 size={14} className="animate-spin text-indigo-500" />}
              <p className="text-xs font-bold text-slate-700">{title}</p>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{done ? "Your video is ready." : failed ? "The generation did not complete." : "Veuillez patienter, votre vidéo est en cours de génération..."}</p>
          </div>

          <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1"><Clock size={11} />{elapsed !== null ? `Elapsed ${fmt(elapsed)}` : "—"}</span>
            <span className="flex items-center gap-1"><Hourglass size={11} />{eta !== null ? `~${fmt(eta)} left` : active ? "Estimating…" : ""}</span>
          </div>
          {stalled && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700">No update for {fmt(stalledFor)}. This is normal while a GPU worker cold-starts or loads the model — the job is still running.</p>}
        </div>
      </div>
    </div>
  );
}
