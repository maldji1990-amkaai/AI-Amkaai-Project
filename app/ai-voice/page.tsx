"use client";

import { useState } from "react";

export default function AIVoicePage() {
  const [text, setText] = useState("");
  const [audio, setAudio] = useState("");
  const [loading, setLoading] = useState(false);

  // 🎯 Generate
  const generateVoice = async () => {
    if (!text) return;

    setLoading(true);

    const res = await fetch("/api/generate-voice", {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
    } else {
      setAudio(data.audio);
    }

    setLoading(false);
  };

  // 💳 Upgrade
  const goToCheckout = async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center">
      <h1 className="text-3xl mb-6">AI Voice Generator 🎤</h1>

      {/* INPUT */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter your text..."
        className="w-full max-w-xl p-3 rounded bg-gray-800 mb-4"
      />

      {/* BUTTON */}
      <button
        onClick={generateVoice}
        className="px-6 py-3 bg-cyan-500 rounded-xl text-black font-bold"
      >
        {loading ? "Generating..." : "Generate Voice"}
      </button>

      {/* PLAYER */}
      {audio && (
        <div className="mt-6 flex flex-col items-center">
          <audio controls src={audio} className="mt-4" />

          <a
            href={audio}
            download="voice.mp3"
            className="mt-4 text-green-400"
          >
            Download Audio 📥
          </a>
        </div>
      )}

      {/* UPGRADE */}
      <button
        onClick={goToCheckout}
        className="mt-8 px-6 py-3 bg-yellow-500 rounded-xl text-black font-bold"
      >
        Upgrade 💳
      </button>
    </div>
  );
}