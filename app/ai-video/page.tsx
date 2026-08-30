"use client";

import { useState, useRef, useEffect } from "react";

const styles = [
  { name: "Cinematic", value: "cinematic lighting, dramatic" },
  { name: "Anime", value: "anime style, vibrant colors" },
  { name: "Realistic", value: "ultra realistic, 4k detailed" },
];

export default function AIVideoPage() {
  const [prompt, setPrompt] = useState("");
  const [video, setVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [style, setStyle] = useState(styles[0].value);
  const [quality, setQuality] = useState("medium");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopPolling(); // 🔥 cleanup عند الخروج
  }, []);

  const formatTime = (sec: number) => {
    if (sec < 60) return `~${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `~${m}m ${s}s`;
  };

  const generateVideo = async () => {
    if (loading) return;

    try {
      stopPolling();

      setLoading(true);
      setVideo(null);
      setStatus("Starting...");
      setProgress(5);
      setPosition(null);
      setEstimatedTime(null);

      const finalPrompt = `${prompt}, ${style}`;

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ prompt: finalPrompt, quality }),
      });

      if (res.status === 402 || res.status === 403) {
        alert(res.status === 402 ? "Not enough credits" : "Subscription expired");
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!data?.jobId) {
        throw new Error("No jobId returned");
      }

      setJobId(data.jobId);

      let attempts = 0;
      const MAX_ATTEMPTS = 60;

      intervalRef.current = setInterval(async () => {
        try {
          attempts++;

          const check = await fetch(`/api/generate-video/status?jobId=${encodeURIComponent(data.jobId)}`);

          const resData = await check.json();

          if (typeof resData.progress === "number") setProgress(Math.max(0, Math.min(100, resData.progress)));

          if (resData.position !== undefined) {
            setPosition(resData.position);
          }

          if (resData.estimatedTime !== undefined) {
            setEstimatedTime(resData.estimatedTime);
          }

          if (resData.status === "pending") {
            setStatus("Waiting in queue...");
          }

          if (resData.status === "processing") {
            setStatus("Generating video...");
            setPosition(null);
          }

          if (resData.status === "cancelled") {
            stopPolling();
            setStatus("Cancelled ❌");
            setLoading(false);
            setProgress(0);
          }

          if (resData.status === "done") {
            stopPolling();
            setVideo(resData.video);
            setStatus("Done ✅");
            setProgress(100);
            setLoading(false);
          }

          // ⏱ timeout
          if (attempts > MAX_ATTEMPTS) {
            stopPolling();
            setLoading(false);
            setStatus("Timeout ⏳");
          }

        } catch (err) {
          console.error(err);
        }
      }, 2000);

    } catch (err) {
      console.error(err);
      alert("Error generating video");
      setLoading(false);
    }
  };

  const cancelJob = async () => {
    if (!jobId) return;

    await fetch("/api/generate-video/cancel", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ jobId }),
    });

    stopPolling();
    setStatus("Cancelled ❌");
    setLoading(false);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">🎬 AI Video Generator</h1>

      <textarea
        placeholder="Describe your video..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full p-4 rounded-xl bg-gray-900 mb-6"
      />

      {/* STYLE */}
      <div className="mb-6">
        <p className="mb-2 text-gray-400">Style</p>
        <div className="flex gap-3 flex-wrap">
          {styles.map((s) => (
            <button
              key={s.name}
              onClick={() => setStyle(s.value)}
              className={`px-4 py-2 rounded-xl border ${
                style === s.value
                  ? "bg-cyan-500 text-black"
                  : "border-gray-700"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* QUALITY */}
      <select
        value={quality}
        onChange={(e) => setQuality(e.target.value)}
        className="bg-gray-900 p-3 rounded-xl mb-6"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>

      {/* BUTTONS */}
      <div className="flex gap-4">
        <button
          onClick={generateVideo}
          disabled={loading}
          className="bg-cyan-500 px-6 py-3 rounded-xl text-black font-semibold"
        >
          {loading ? "Processing..." : "Generate Video"}
        </button>

        {loading && (
          <button
            onClick={cancelJob}
            className="bg-red-500 px-6 py-3 rounded-xl"
          >
            Cancel
          </button>
        )}
      </div>

      {/* QUEUE */}
      {position !== null && (
        <div className="mt-6 text-yellow-400">
          ⏳ Position: {position}
          {estimatedTime && ` • ${formatTime(estimatedTime)}`}
        </div>
      )}

      {/* PROGRESS */}
      {loading && (
        <div className="mt-6 max-w-xl">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>{status}</span>
            <span>{Math.floor(progress)}%</span>
          </div>

          <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
            <div
              className="bg-cyan-500 h-3 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* RESULT */}
      {video && (
        <div className="mt-10">
          <video controls className="w-full rounded-xl mb-4">
            <source src={video} type="video/mp4" />
          </video>
        </div>
      )}
    </div>
  );
}