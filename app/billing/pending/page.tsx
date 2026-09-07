"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const [status, setStatus] = useState("PENDING");
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch("/api/payment-status");
      const data = await res.json();

      if (data.status === "COMPLETED") {
        router.push("/dashboard");
      }

      setStatus(data.status);
    }, 5000); // كل 5 ثواني

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-6">

      <h1 className="text-3xl font-bold">Processing Payment ⏳</h1>

      {status === "PENDING" && (
        <p className="text-yellow-400">
          Waiting for admin approval...
        </p>
      )}

      {status === "REJECTED" && (
        <p className="text-red-400">
          ❌ Payment rejected. Please try again.
        </p>
      )}

      <button
        onClick={() => location.reload()}
        className="bg-white text-black px-4 py-2 rounded"
      >
        Refresh
      </button>

    </div>
  );
}