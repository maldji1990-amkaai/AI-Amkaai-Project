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
    case "UPLOADING":
      return 4;
    case "ENCODING":
      return 3;
    case "GENERATING":
    case "DECODING":
      return 2;
    default:
      return 1; // processing but the GPU has not reported a stage yet
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
    const stepTxt =
      typeof p.step === "number" && typeof p.totalSteps === "number" ? `Step ${p.step}/${p.totalSteps}` : "Sampling frames";
    return { title: `Rendering${clipTxt}`, detail: stepTxt };
  }
  if (stage === "DECODING") return { title: `Decoding frames${clipTxt}`, detail: "Converting latents to video frames." };
  if (stage === "ENCODING") return { title: "Encoding video", detail: "Writing and merging MP4 clips." };
  if (stage === "UPLOADING") return { title: "Uploading", detail: "Publishing your video." };
  if (stage === "PREPARING") return { title: "Preparing", detail: "Loading prompt and inputs." };
  return {
    title: phase <= 1 ? "Starting GPU worker" : "Processing",
    detail: "A cold start can take 1–3 minutes the first time.",
  };
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

  const target = done ? 100 : Math.max(0, Math.min(100, progress || 0));
  const phase = phaseIndex(status, stage);
  const indeterminate = active && phase <= 1;

  // ---- smooth, never-backwards display value --------------------------------
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
        // creep slightly past the last reported value so the bar feels alive between steps
        const ceiling = done ? 100 : Math.min(99, target + (stage ? 1.2 : 0));
        const goal = cur < target ? target : ceiling;
        const next = cur + (goal - cur) * (cur < target ? 0.2 : 0.02);
        return Math.abs(goal - next) < 0.05 ? goal : Math.max(cur, next);
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [target, active, done, stage]);

  // ---- clock, ETA, stall detection ------------------------------------------
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const samples = useRef<{ key?: string; pts: { t: number; p: number }[]; lastChange: number }>({
    key: jobKey,
    pts: [],
    lastChange: Date.now(),
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
  const barColor = failed
    ? "from-red-500 to-red-400"
    : done
      ? "from-emerald-500 to-emerald-400"
      : "from-teal-500 via-cyan-500 to-teal-400";

  const bar = (h: string) => (
    <div
      className={`w-full ${h} rounded-full bg-slate-200/70 overflow-hidden shadow-inner`}
      role="progressbar"
      aria-label={title}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r ${barColor} relative transition-[width] duration-500 ease-out`}
        style={{ width: `${Math.max(active ? 3 : 0, Math.min(100, shown))}%` }}
      >
        {active && <div className="absolute inset-0 bg-white/25 animate-pulse" />}
      </div>
    </div>
  );

  if (variant === "compact") {
    const short =
      status === "queued"
        ? "QUEUED"
        : done
          ? "DONE"
          : failed
            ? status.toUpperCase()
            : (stage || "").toUpperCase() === "GENERATING" && typeof props.step === "number" && typeof props.totalSteps === "number"
              ? `${props.step}/${props.totalSteps}`
              : title.toUpperCase();
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
          <span className="truncate">{short}</span>
          <span className="text-teal-600 shrink-0 tabular-nums">{status === "queued" ? "" : `${pct}%`}</span>
        </div>
        {bar("h-1")}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-700 flex items-center gap-2">
            {active && <Loader2 size={14} className="animate-spin text-teal-600 shrink-0" />}
            <span className="truncate">{title}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>
        </div>
        <span className="text-2xl font-black text-teal-600 tabular-nums leading-none">{pct}%</span>
      </div>

      {bar("h-3")}

      <ol className="grid grid-cols-5 gap-1">
        {PHASES.map((ph, i) => {
          const complete = done || i < phase;
          const current = !done && i === phase && active;
          const Icon = ph.icon;
          return (
            <li key={ph.key} className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] transition-colors ${
                  complete
                    ? "bg-teal-500 border-teal-500 text-white"
                    : current
                      ? "border-teal-500 text-teal-600 bg-teal-50 animate-pulse"
                      : "border-slate-300 text-slate-400 bg-white"
                }`}
              >
                {complete ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
              </span>
              <span
                className={`text-[9px] font-mono uppercase tracking-wide truncate ${
                  complete || current ? "text-teal-600" : "text-slate-400"
                }`}
              >
                {ph.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {elapsed !== null ? `Elapsed ${fmt(elapsed)}` : "—"}
        </span>
        <span className="flex items-center gap-1">
          <Hourglass size={10} />
          {eta !== null ? `~${fmt(eta)} left` : active ? "Estimating…" : ""}
        </span>
      </div>

      {stalled && (
        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          No update for {fmt(stalledFor)}. This is normal while a GPU worker cold-starts or loads the model — the job is still running.
        </p>
      )}
    </div>
  );
}
