"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Film,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";

type VideoStatus = "queued" | "processing" | "finalizing" | "completed" | "failed" | "cancelled";

type VideoJob = {
  id: string;
  jobId?: string | null;
  prompt?: string | null;
  progress?: number | null;
  progressStage?: string | null;
  progressClip?: number | null;
  progressClipCount?: number | null;
  progressStep?: number | null;
  progressTotalSteps?: number | null;
  status?: string | null;
  resultUrl?: string | null;
  finalVideoUrl?: string | null;
  error?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  durationSeconds?: number | null;
  generationStatus?: string | null;
};

function normalizeStatus(job: VideoJob): VideoStatus {
  const raw = String(job.status || job.generationStatus || "queued").toUpperCase();
  if (raw === "COMPLETED" && (job.finalVideoUrl || job.resultUrl)) return "completed";
  if (raw === "FAILED") return "failed";
  if (raw === "CANCELLED") return "cancelled";
  if (raw === "FINALIZING") return "finalizing";
  if (raw === "PROCESSING") return "processing";
  return "queued";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: VideoStatus) {
  switch (status) {
    case "completed": return "Completed";
    case "processing": return "Processing";
    case "finalizing": return "Finalizing";
    case "failed": return "Failed";
    case "cancelled": return "Cancelled";
    default: return "Queued";
  }
}

function StatusIcon({ status }: { status: VideoStatus }) {
  if (status === "completed") return <CheckCircle2 size={15} />;
  if (status === "failed" || status === "cancelled") return <XCircle size={15} />;
  if (status === "queued") return <Clock3 size={15} />;
  return <Loader2 size={15} className="animate-spin" />;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<VideoJob | null>(null);

  const loadJobs = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-video/jobs", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setError("Please sign in to view your videos.");
        } else {
          setError(data?.error || "Unable to load your videos.");
        }
        setJobs([]);
        return;
      }

      const incoming = Array.isArray(data?.jobs) ? data.jobs : [];
      setJobs(incoming);
    } catch (err) {
      console.error("MY_VIDEOS_LOAD_FAILED", err);
      setError("Unable to load your videos. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
    const interval = window.setInterval(() => void loadJobs(), 5000);
    return () => window.clearInterval(interval);
  }, [loadJobs]);

  const completedJobs = useMemo(
    () => jobs.filter((job) => normalizeStatus(job) === "completed" && (job.finalVideoUrl || job.resultUrl)),
    [jobs],
  );

  const activeJobs = useMemo(
    () => jobs.filter((job) => {
      const status = normalizeStatus(job);
      return status === "queued" || status === "processing" || status === "finalizing";
    }),
    [jobs],
  );

  return (
    <main className="min-h-screen bg-[#f5fbf8] text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
              aria-label="Back to studio"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Film size={18} className="text-teal-600" />
                <h1 className="text-lg font-black tracking-tight">My Videos</h1>
              </div>
              <p className="text-xs text-slate-500">Your generated video library</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadJobs(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Film size={18} />
            </div>
            <p className="text-2xl font-black">{jobs.length}</p>
            <p className="mt-1 text-xs text-slate-500">Total generations</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
            <p className="text-2xl font-black">{completedJobs.length}</p>
            <p className="mt-1 text-xs text-slate-500">Completed videos</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock3 size={18} />
            </div>
            <p className="text-2xl font-black">{activeJobs.length}</p>
            <p className="mt-1 text-xs text-slate-500">Currently processing</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <Loader2 size={28} className="mx-auto animate-spin text-teal-600" />
              <p className="mt-3 text-sm font-semibold text-slate-600">Loading your videos...</p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-[430px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center shadow-sm">
            <div className="max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <Sparkles size={28} />
              </div>
              <h2 className="mt-5 text-xl font-black">No videos yet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your completed and in-progress AI video generations will appear here automatically.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700"
              >
                <Sparkles size={16} /> Create a video
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => {
              const status = normalizeStatus(job);
              const videoUrl = job.finalVideoUrl || job.resultUrl || null;
              const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));

              return (
                <article key={job.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="relative aspect-video bg-slate-950">
                    {videoUrl && status === "completed" ? (
                      <video
                        src={videoUrl}
                        preload="metadata"
                        className="h-full w-full object-cover"
                        onClick={() => setSelectedJob(job)}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
                        {status === "failed" || status === "cancelled" ? (
                          <XCircle size={30} className="text-red-400" />
                        ) : (
                          <Loader2 size={30} className="animate-spin text-teal-300" />
                        )}
                        <p className="mt-3 text-sm font-bold">{statusLabel(status)}</p>
                        {status !== "failed" && status !== "cancelled" && (
                          <div className="mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
                            <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                      <StatusIcon status={status} />
                      {statusLabel(status)}
                    </div>

                    {videoUrl && status === "completed" && (
                      <button
                        type="button"
                        onClick={() => setSelectedJob(job)}
                        className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-teal-700 opacity-0 shadow-lg transition hover:bg-white focus:opacity-100 group-hover:opacity-100"
                        aria-label="Play video"
                      >
                        <Play size={20} fill="currentColor" />
                      </button>
                    )}
                  </div>

                  <div className="p-4">
                    <p className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-700">
                      {job.prompt || "AI Video generation"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {job.createdAt && (
                        <span className="flex items-center gap-1"><CalendarDays size={12} /> {formatDate(job.createdAt)}</span>
                      )}
                      {job.durationSeconds && <span>{job.durationSeconds}s</span>}
                    </div>

                    {videoUrl && status === "completed" && (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedJob(job)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-teal-700"
                        >
                          <Play size={13} fill="currentColor" /> Play
                        </button>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                          aria-label="Open video"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <a
                          href={videoUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                          aria-label="Download video"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedJob && (selectedJob.finalVideoUrl || selectedJob.resultUrl) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm" onClick={() => setSelectedJob(null)}>
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <video
              src={selectedJob.finalVideoUrl || selectedJob.resultUrl || undefined}
              controls
              autoPlay
              className="max-h-[78vh] w-full object-contain"
            />
            <div className="flex items-center justify-between gap-4 bg-white px-4 py-3">
              <p className="line-clamp-1 text-sm font-semibold text-slate-700">{selectedJob.prompt || "AI Video"}</p>
              <a
                href={selectedJob.finalVideoUrl || selectedJob.resultUrl || "#"}
                download
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white"
              >
                <Download size={14} /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
