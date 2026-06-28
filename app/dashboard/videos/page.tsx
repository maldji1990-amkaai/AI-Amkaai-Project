"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Video, Download, Clock, CheckCircle2, XCircle,
  Loader2, Search, Filter, RefreshCw, Play, Mic,
  ImageIcon, Sparkles, ArrowLeft, Calendar, Wand2
} from "lucide-react";

/* ── Types ── */
type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
type JobType   = "video" | "image" | "voice";

interface MediaJob {
  id:        string;
  prompt:    string;
  status:    JobStatus;
  resultUrl: string | null;
  createdAt: string;
  finishedAt:string | null;
  progress:  number;
  type:      JobType;
}

/* ── Helpers ── */
const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:    { label: "Pending",    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: <Clock size={11} /> },
  PROCESSING: { label: "Processing", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",       icon: <Loader2 size={11} className="animate-spin" /> },
  COMPLETED:  { label: "Completed",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 size={11} /> },
  FAILED:     { label: "Failed",     color: "text-red-400 bg-red-500/10 border-red-500/20",           icon: <XCircle size={11} /> },
  CANCELLED:  { label: "Cancelled",  color: "text-gray-400 bg-gray-500/10 border-gray-500/20",        icon: <XCircle size={11} /> },
};

const TYPE_CONFIG: Record<JobType, { label: string; color: string; icon: React.ReactNode }> = {
  video: { label: "AI Video", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: <Video size={11} /> },
  image: { label: "AI Image", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <ImageIcon size={11} /> },
  voice: { label: "AI Voice", color: "text-amber-400 bg-amber-500/10 border-amber-500/20",   icon: <Mic size={11} /> },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function TimeAgo({ iso }: { iso: string }) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return <span>{secs}s ago</span>;
  if (secs < 3600) return <span>{Math.floor(secs/60)}m ago</span>;
  if (secs < 86400) return <span>{Math.floor(secs/3600)}h ago</span>;
  return <span>{Math.floor(secs/86400)}d ago</span>;
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function MyVideosPage() {
  const [jobs,       setJobs]       = useState<MediaJob[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState<JobType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all");
  const [activeJob,  setActiveJob]  = useState<MediaJob | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ── Fetch all jobs ── */
  const fetchJobs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      // نجلب VideoJob + ImageJob + VoiceJob من API واحد
      const [vRes, iRes, aRes] = await Promise.all([
        fetch("/api/my-videos"),
        fetch("/api/my-images"),
        fetch("/api/my-voices"),
      ]);

      const videos: MediaJob[] = vRes.ok
        ? (await vRes.json()).map((j: any) => ({ ...j, type: "video" as JobType }))
        : [];
      const images: MediaJob[] = iRes.ok
        ? (await iRes.json()).map((j: any) => ({ ...j, type: "image" as JobType }))
        : [];
      const voices: MediaJob[] = aRes.ok
        ? (await aRes.json()).map((j: any) => ({ ...j, type: "voice" as JobType }))
        : [];

      const all = [...videos, ...images, ...voices].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setJobs(all);
    } catch (e) {
      setError("Failed to load your media. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  /* ── Auto-refresh if any job is PENDING/PROCESSING ── */
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === "PENDING" || j.status === "PROCESSING");
    if (!hasActive) return;
    const t = setInterval(() => fetchJobs(true), 5000);
    return () => clearInterval(t);
  }, [jobs]);

  /* ── Filtered list ── */
  const filtered = jobs.filter(j => {
    const matchSearch = j.prompt.toLowerCase().includes(search.toLowerCase());
    const matchType   = filterType   === "all" || j.type   === filterType;
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  /* ── Stats ── */
  const stats = {
    total:     jobs.length,
    completed: jobs.filter(j => j.status === "COMPLETED").length,
    pending:   jobs.filter(j => j.status === "PENDING" || j.status === "PROCESSING").length,
    failed:    jobs.filter(j => j.status === "FAILED").length,
  };

  /* ════════════════════════════════════
     RENDER
  ════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#030305] text-white font-sans">

      {/* ── Background ── */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.05),transparent_50%)] pointer-events-none" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#030305]/80 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-gray-500 hover:text-white transition text-sm">
              <ArrowLeft size={15} /> Back
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center">
                <Play size={12} className="text-black" fill="black" />
              </div>
              <span className="font-black text-base bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                My Media
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchJobs(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-xs text-gray-400 hover:text-white"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link href="/#studio"
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-black text-xs hover:opacity-90 transition">
              <Wand2 size={12} /> New Creation
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Created", value: stats.total,     color: "from-cyan-500 to-indigo-500",   icon: <Sparkles size={16} /> },
            { label: "Completed",     value: stats.completed, color: "from-emerald-500 to-teal-500",  icon: <CheckCircle2 size={16} /> },
            { label: "In Progress",   value: stats.pending,   color: "from-yellow-500 to-orange-500", icon: <Loader2 size={16} /> },
            { label: "Failed",        value: stats.failed,    color: "from-red-500 to-rose-500",      icon: <XCircle size={16} /> },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-black flex-shrink-0`}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-[11px] text-gray-500 font-mono">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <Search size={13} className="text-gray-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by prompt..."
              className="bg-transparent text-xs text-white placeholder:text-gray-600 outline-none flex-1"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1">
            {(["all", "video", "image", "voice"] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition ${filterType === t ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                {t === "all" ? "All Types" : TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1">
            {(["all", "COMPLETED", "PROCESSING", "PENDING", "FAILED"] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${filterStatus === s ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                {s === "all" ? "All Status" : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 font-mono">Loading your media library...</p>
          </div>

        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <XCircle size={40} className="text-red-400" />
            <p className="text-sm text-red-400 font-bold">{error}</p>
            <button onClick={() => fetchJobs()} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition">
              Try Again
            </button>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Video size={28} className="text-gray-600" />
            </div>
            <div>
              <p className="text-base font-black text-gray-400">No media found</p>
              <p className="text-sm text-gray-600 mt-1">
                {search || filterType !== "all" || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Start creating your first AI video!"}
              </p>
            </div>
            {!search && filterType === "all" && (
              <Link href="/#studio"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-black text-sm hover:opacity-90 transition">
                <Wand2 size={14} /> Create Now
              </Link>
            )}
          </div>

        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(job => (
              <JobCard key={job.id} job={job} onClick={() => setActiveJob(job)} />
            ))}
          </div>
        )}
      </main>

      {/* ── Preview Modal ── */}
      {activeJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) setActiveJob(null); }}
        >
          <div className="w-full max-w-2xl bg-[#0f0f17] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {/* Preview area */}
            <div className="bg-black relative aspect-video flex items-center justify-center">
              {activeJob.status === "COMPLETED" && activeJob.resultUrl ? (
                activeJob.type === "voice" ? (
                  <audio src={activeJob.resultUrl} controls className="w-[80%] accent-amber-400" />
                ) : activeJob.type === "image" ? (
                  <img src={activeJob.resultUrl} alt={activeJob.prompt} className="max-h-full max-w-full object-contain" />
                ) : (
                  <video src={activeJob.resultUrl} controls autoPlay loop className="max-h-full max-w-full object-contain" />
                )
              ) : (
                <div className="text-center space-y-3">
                  {activeJob.status === "PROCESSING" || activeJob.status === "PENDING" ? (
                    <>
                      <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-cyan-400 font-mono animate-pulse">
                        {activeJob.status === "PROCESSING" ? `Processing… ${activeJob.progress}%` : "Queued — starting soon"}
                      </p>
                      {activeJob.status === "PROCESSING" && (
                        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all"
                            style={{ width: `${activeJob.progress}%` }} />
                        </div>
                      )}
                    </>
                  ) : (
                    <XCircle size={32} className="mx-auto text-red-400" />
                  )}
                </div>
              )}
              <button onClick={() => setActiveJob(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-gray-400 hover:text-white transition text-sm">
                ✕
              </button>
            </div>

            {/* Info */}
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-white leading-snug flex-1">{activeJob.prompt}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${TYPE_CONFIG[activeJob.type].color}`}>
                    {TYPE_CONFIG[activeJob.type].icon} {TYPE_CONFIG[activeJob.type].label}
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${STATUS_CONFIG[activeJob.status].color}`}>
                    {STATUS_CONFIG[activeJob.status].icon} {STATUS_CONFIG[activeJob.status].label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
                <Calendar size={11} />
                {formatDate(activeJob.createdAt)}
                {activeJob.finishedAt && (
                  <span className="ml-2 text-emerald-500">
                    ✓ Done in {Math.round((new Date(activeJob.finishedAt).getTime() - new Date(activeJob.createdAt).getTime()) / 1000)}s
                  </span>
                )}
              </div>
              {activeJob.status === "COMPLETED" && activeJob.resultUrl && (
                <a href={activeJob.resultUrl} download target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-black text-xs hover:opacity-90 transition">
                  <Download size={13} /> Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Job Card ── */
function JobCard({ job, onClick }: { job: MediaJob; onClick: () => void }) {
  const statusCfg = STATUS_CONFIG[job.status];
  const typeCfg   = TYPE_CONFIG[job.type];

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer overflow-hidden"
    >
      {/* Thumbnail / Preview area */}
      <div className="aspect-video bg-[#060608] relative flex items-center justify-center overflow-hidden">
        {job.status === "COMPLETED" && job.resultUrl ? (
          job.type === "voice" ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Mic size={20} className="text-amber-400" />
              </div>
              <p className="text-[10px] text-amber-400 font-mono">Audio Ready</p>
            </div>
          ) : job.type === "image" ? (
            <img src={job.resultUrl} alt={job.prompt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <video src={job.resultUrl} muted loop
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onMouseEnter={e => (e.target as HTMLVideoElement).play()}
              onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
            />
          )
        ) : job.status === "PROCESSING" ? (
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[10px] text-cyan-400 font-mono animate-pulse">{job.progress}%</p>
            <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all"
                style={{ width: `${job.progress}%` }} />
            </div>
          </div>
        ) : job.status === "PENDING" ? (
          <div className="text-center space-y-2">
            <Clock size={24} className="mx-auto text-yellow-400 animate-pulse" />
            <p className="text-[10px] text-yellow-400 font-mono">Queued</p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <XCircle size={24} className="mx-auto text-red-400" />
            <p className="text-[10px] text-red-400 font-mono">Failed</p>
          </div>
        )}

        {/* Overlay play button on hover (for completed video) */}
        {job.status === "COMPLETED" && job.resultUrl && job.type === "video" && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play size={16} className="text-white" fill="white" />
            </div>
          </div>
        )}

        {/* Type badge */}
        <div className={`absolute top-2 left-2 flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg border backdrop-blur-sm ${typeCfg.color}`}>
          {typeCfg.icon} {typeCfg.label}
        </div>

        {/* Download button */}
        {job.status === "COMPLETED" && job.resultUrl && (
          <a
            href={job.resultUrl} download target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition"
          >
            <Download size={11} />
          </a>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <p className="text-[12px] font-semibold text-gray-200 line-clamp-2 leading-snug">{job.prompt}</p>
        <div className="flex items-center justify-between">
          <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${statusCfg.color}`}>
            {statusCfg.icon} {statusCfg.label}
          </span>
          <span className="text-[10px] text-gray-600 font-mono">
            <TimeAgo iso={job.createdAt} />
          </span>
        </div>
      </div>
    </div>
  );
}
