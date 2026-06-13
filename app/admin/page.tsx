"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";

type Payment = {
  id: string;
  userId: string;
  plan: string;
  amount: number;
  status: string;
  method: string;
  createdAt: string;
};

export default function AdminPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // 📥 1. جلب طلبات الدفع من المسار المعزول والمخصص للبيانات
  const loadPayments = async () => {
    try {
      const res = await fetch("/api/admin/payments"); 
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (error) {
      console.error("Failed to load payments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  // ⚡ 2. إرسال أمر التفعيل إلى المسار المخصص للـ approve-request بعد عزله
  const approve = async (id: string) => {
    if (!confirm("هل تأكدت من وصول الأموال إلى حسابك وتريد تفعيل باقة المشترك الآن؟")) return;

    try {
      const res = await fetch("/api/admin/approve-request", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: id }),
      });

      if (res.ok) {
        alert("🎉 تم التفعيل بنجاح وتحديث خطة العميل وشحن نقاطه!");
        setPayments((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: "COMPLETED" } : p
          )
        );
      } else {
        const errData = await res.json();
        alert(`حدث خطأ أثناء التفعيل: ${errData.error || "تعذر المعالجة"}`);
      }
    } catch (error) {
      console.error(error);
      alert("حدث خطأ في الاتصال بالسيرفر.");
    }
  };

  // ❌ 3. إرسال أمر الرفض إلى المسار الفرعي للـ reject
  const reject = async (id: string) => {
    if (!confirm("هل تريد رفض هذا الطلب؟")) return;

    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: id }),
      });

      if (res.ok) {
        alert("❌ تم رفض الطلب بنجاح.");
        setPayments((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: "REJECTED" } : p
          )
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 space-y-8 font-sans" dir="rtl">

      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-yellow-400">Admin PRO Dashboard 🧠</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 hidden sm:inline">لوحة الإشراف والتفعيل الفوري</span>
          <UserButton />
        </div>
      </div>

      <div className="text-right">
        <h2 className="text-xl font-semibold text-gray-300">طلبات التفعيل المعلقة (بريدي موب & Crypto)</h2>
        <p className="text-xs text-gray-500 mt-1">يرجى مراجعة حسابك أولاً قبل الضغط على تفعيل الباقة.</p>
      </div>

      {loading && <p className="text-center text-gray-400 animate-pulse">جاري تحميل المعاملات...</p>}

      {!loading && payments.filter(p => p.status === "PENDING").length === 0 ? (
        <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/10 text-gray-400">
          👍 لا توجد أي طلبات معلقة حالياً. كل الحسابات نشطة!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {payments
            .filter((p) => p.status === "PENDING")
            .map((p) => (
              <div
                key={p.id}
                className="bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col justify-between hover:border-white/20 transition"
              >
                <div className="space-y-2 text-sm mb-4 text-right">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs text-gray-500 font-mono select-all">ID: {p.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.plan === "PREMIUM" ? "bg-purple-900 text-purple-200" : "bg-blue-900 text-blue-200"}`}>
                      {p.plan}
                    </span>
                  </div>
                  
                  <p className="text-gray-400 text-xs truncate">معرف العميل: <span className="text-white font-mono">{p.userId}</span></p>
                  
                  <p className="text-gray-400">
                    طريقة الإيداع:{" "}
                    <span className="text-yellow-400 font-medium">
                      {p.method === "baridimob" ? "💳 بريدي موب" : "🪙 TRC20 Crypto"}
                    </span>
                  </p>
                  
                  <p className="text-gray-400">
                    المبلغ المستحق: <span className="text-green-400 font-bold font-mono text-base">{p.amount} DZD/USD</span>
                  </p>

                  <p className="text-gray-500 text-xs">
                    تاريخ الإنشاء: {new Date(p.createdAt).toLocaleString("ar-DZ")}
                  </p>
                </div>

                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={() => approve(p.id)}
                    className="flex-1 bg-green-500 py-2.5 rounded-xl text-black font-bold hover:bg-green-400 active:scale-95 transition text-xs shadow-lg"
                  >
                    تفعيل الحساب الآن ✅
                  </button>

                  <button
                    onClick={() => reject(p.id)}
                    className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black py-2.5 px-4 rounded-xl font-bold active:scale-95 transition text-xs border border-red-500/20"
                  >
                    رفض ❌
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}