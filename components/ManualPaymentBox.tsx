"use client";

import { useState, useEffect } from "react";

interface ManualPaymentBoxProps {
  plan: "pro" | "premium";
  userEmail: string;
}

export default function ManualPaymentBox({ plan, userEmail }: ManualPaymentBoxProps) {
  const [paymentMethod, setPaymentMethod] = useState<"baridimob" | "crypto">("baridimob");
  const [isPending, setIsPending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 دقائق بالثواني

  // تشغيل العداد التنازلي عند الضغط على الزر
  useEffect(() => {
    if (!isPending || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isPending, timeLeft]);

  const handleSubmitRequest = async () => {
    setIsPending(true);
    setTimeLeft(300); // إعادة ضبط الـ 5 دقائق

    try {
      const res = await fetch("/api/manual-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          paymentMethod,
          email: userEmail,
        }),
      });

      if (!res.ok) {
        alert("حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مجدداً.");
        setIsPending(false);
      }
    } catch (error) {
      console.error(error);
      setIsPending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl max-w-md mx-auto text-white text-right font-sans" dir="rtl">
      <h3 className="text-xl font-bold mb-4 text-center">الدفع المحلي عبر بريدي موب / Crypto</h3>
      
      {/* اختيار طريقة الدفع */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setPaymentMethod("baridimob")}
          className={`flex-1 py-2 rounded-lg text-center font-medium ${paymentMethod === "baridimob" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}
        >
          بريدي موب (Baridimob)
        </button>
        <button 
          onClick={() => setPaymentMethod("crypto")}
          className={`flex-1 py-2 rounded-lg text-center font-medium ${paymentMethod === "crypto" ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400"}`}
        >
          Crypto (USDT TRC20)
        </button>
      </div>

      {/* تفاصيل الدفع بناءً على الاختيار */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6 text-center text-sm">
        {paymentMethod === "baridimob" ? (
          <div>
            <p className="font-semibold text-yellow-400 mb-2">يرجى إرسال مبلغ الباقة إلى الحساب التالي:</p>
            <p className="bg-gray-900 p-2 rounded tracking-wider select-all font-mono my-2 text-lg">00799999000123456789</p>
            <p className="text-gray-400">الاسم: بن جامع محمد</p>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-yellow-400 mb-2">يرجى إرسال مبلغ الباقة إلى المحفظة التالية:</p>
            <p className="bg-gray-900 p-2 rounded tracking-tight select-all font-mono my-2 text-xs break-all">TY67rX93hskdjf93847hsdkfjhskiwueh3</p>
            <p className="text-gray-400">الشبكة: Tron (TRC-20)</p>
          </div>
        )}
      </div>

      {/* الزر والـ Timer */}
      {!isPending ? (
        <button
          onClick={handleSubmitRequest}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition duration-200"
        >
          لقد قمت بالدفع، فعّل اشتراكي الآن 🚀
        </button>
      ) : (
        <div className="text-center bg-gray-800 p-4 rounded-lg border border-yellow-600/30">
          <p className="text-yellow-400 font-semibold mb-2">جاري التحقق يدويًا من وصول أموالك...</p>
          <div className="text-3xl font-mono font-bold text-white tracking-widest my-2">
            {timeLeft > 0 ? formatTime(timeLeft) : "لحظات إضافية..."}
          </div>
          <p className="text-xs text-gray-400">
            {timeLeft > 0 
              ? "يتم الآن مطابقة المعاملة على حسابنا. يمكنك الانتظار أو تصفح الموقع، سيتم تفعيل حسابك تلقائياً بمجرد تأكيد الإيداع."
              : "العملية تستغرق وقتاً أطول بقليل، نحن نراجع حسابنا الآن، سيتم تفعيل باقتك خلال دقيقة!"}
          </p>
        </div>
      )}
    </div>
  );
}