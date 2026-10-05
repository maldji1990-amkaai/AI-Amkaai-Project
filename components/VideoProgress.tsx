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

const HUD_ANIMATION_STYLE = (
  <style jsx global>{`
    @keyframes progress-shine {
      0% { transform: translateX(0) skewX(-18deg); opacity: 0; }
      15% { opacity: 0.7; }
      60% { opacity: 0.25; }
      100% { transform: translateX(420%) skewX(-18deg); opacity: 0; }
    }
  `}</style>
);

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
    <>
      {HUD_ANIMATION_STYLE}
      <div className="w-full text-center">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#050b14] px-5 py-7 shadow-[0_0_55px_rgba(6,182,212,0.16)]">
        {/* Futuristic background glow — visual only */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
          <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] [background-size:28px_28px] animate-[pulse_3s_ease-in-out_infinite]" />
        </div>

        <div className="relative z-10">
          {/* Brand */}
          <div className="mb-5 flex items-center justify-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-400/10 text-[11px] font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)]">
              A
            </div>
            <div className="text-left leading-none">
              <div className="text-[15px] font-black tracking-[0.22em] text-white">AMKAAI</div>
              <div className="mt-1 text-[7px] font-bold tracking-[0.3em] text-cyan-300/70">POWERED BY AI</div>
            </div>
          </div>

          {/* Percentage HUD */}
          <div className="relative mx-auto mb-6 flex h-48 w-48 items-center justify-center">
            <div className="absolute inset-5 rounded-full border border-cyan-400/15" />
            <div className="absolute inset-8 rounded-full border border-dashed border-cyan-300/20 animate-[spin_18s_linear_infinite]" />
            <div className="absolute inset-11 rounded-full border border-cyan-400/20" />
            <div className="absolute inset-[4.25rem] rounded-full bg-cyan-400/5 shadow-[0_0_55px_rgba(34,211,238,0.22)]" />
            <div className="absolute inset-0 rounded-full border border-transparent border-t-cyan-300/90 border-r-cyan-500/30 animate-[spin_3.5s_linear_infinite]" />
            <div className="absolute inset-3 rounded-full border border-transparent border-b-blue-400/30 border-l-cyan-300/30 animate-[spin_7s_linear_infinite_reverse]" />

            <div className="relative z-10 animate-[pulse_2.2s_ease-in-out_infinite]">
              <div
                className={`text-5xl font-black tracking-tight tabular-nums ${
                  failed
                    ? "text-red-400"
                    : done
                      ? "text-emerald-400"
                      : "text-cyan-300"
                }`}
                aria-live="polite"
              >
                {pct}%
              </div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.3em] text-slate-400">
                {done ? "Completed" : failed ? "Generation stopped" : "Generating"}
              </div>
            </div>
          </div>

          {/* Real progress bar — width still uses the existing RunPod-backed value */}
          <div className="mb-6 relative">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label={title}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div
                className={`relative h-full rounded-full transition-[width] duration-500 ease-out ${
                  failed
                    ? "bg-gradient-to-r from-red-500 to-red-300"
                    : done
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                      : "bg-gradient-to-r from-blue-500 via-cyan-300 to-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.7)]"
                }`}
                style={{ width: `${Math.max(active ? 3 : 0, Math.min(100, shown))}%` }}
              >
                {active && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                {active && <div className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-white/25 blur-sm animate-[progress-shine_1.8s_linear_infinite]" />}
              </div>
            </div>
          </div>

          {/* Generation phases */}
          <ol className="mb-5 grid grid-cols-5 gap-1">
            {PHASES.map((ph, i) => {
              const complete = done || i < phase;
              const current = !done && i === phase && active;
              const Icon = ph.icon;

              return (
                <li key={ph.key} className="flex min-w-0 flex-col items-center gap-1.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] transition-all duration-300 ${
                      complete
                        ? "border-cyan-300 bg-cyan-300 text-[#061018] shadow-[0_0_16px_rgba(34,211,238,0.45)]"
                        : current
                          ? "border-cyan-300/80 bg-cyan-400/10 text-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.38)] animate-pulse"
                          : "border-white/10 bg-white/[0.03] text-slate-500"
                    }`}
                  >
                    {complete ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
                  </span>
                  <span
                    className={`truncate text-[8px] font-bold uppercase tracking-wider ${
                      complete || current ? "text-cyan-300" : "text-slate-500"
                    }`}
                  >
                    {ph.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Status */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-center gap-2">
              {active && <Loader2 size={13} className="animate-spin text-cyan-300" />}
              <p className="text-xs font-bold text-white/90">{title}</p>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
            <p className="mt-3 text-[9px] font-medium tracking-wide text-cyan-300/60">
              {done
                ? "Your video is ready."
                : failed
                  ? "The generation did not complete."
                  : "Veuillez patienter, votre vidéo est en cours de génération..."}
            </p>
          </div>

          {/* Timing information */}
          <div className="mt-4 flex items-center justify-between text-[9px] font-mono text-slate-500">
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
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-1.5 text-[10px] text-amber-300">
              No update for {fmt(stalledFor)}. This is normal while a GPU worker cold-starts or loads the model — the job is still running.
            </p>
          )}
        </div>
      </div>
      </div>
    </>
  );
}