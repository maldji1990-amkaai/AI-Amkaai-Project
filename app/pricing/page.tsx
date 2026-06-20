"use client";

import { useState, useEffect } from "react";

// 1. إعادة بناء الباقات المحدثة ديناميكياً لتتوافق مع نظام الـ API والأسعار الجديدة
const PLANS = {
  trial: {
    id: "trial",
    name: "3-Day Full Access", // تم الحفاظ على مسمى الوضوح والشفافية
    priceMain: "$1.99", // ◄ تم التعديل إلى السعر الجديد 1.99$
    priceSub: "for 3 days",
    dueNowText: "$1.99", // ◄ المستحق الآن أصبح 1.99$
    usd: 1.99, usdt: 1.99, dzd: 400, // ◄ تم تعديل القيمة بالدينار الجزائري لتناسب الـ 1.99$ تلقائياً (400 دج)
    quality: "720p HD Quality",
    badge: "",
    terms: "Get a 3-day trial for just $1.99 with 30 credits and 720p access. After the trial, you'll be charged $17.99/month unless you cancel through your account settings.",
  },
  quarterly: {
    id: "quarterly",
    name: "🎬 Creator Pro", // ◄ مسمى تسويقي قوي ومغري لصناع المحتوى
    priceMain: "$14.99",
    priceSub: "per month",
    dueNowText: "$44.97",
    usd: 44.97, usdt: 44.97, dzd: 9000,
    quality: "720p HD Quality",
    badge: "Most Popular", // ◄ شارة ذهبية لتحفيز الاختيار وزيادة المبيعات
    terms: "You will be charged a quarterly subscription of $44.97 every 3 months with 720p HD access (equivalent to $14.99/month). Cancel anytime.",
  },
  biannually: {
    id: "biannually",
    name: "👑 Studio Ultra 1080p", // ◄ مسمى فاخر يبرر القوة الكبيرة لمحرك Kling والدقة العالية
    priceMain: "$12.99",
    priceSub: "per month",
    dueNowText: "$77.94",
    usd: 77.94, usdt: 77.94, dzd: 15500,
    quality: "1080p Full HD Cinematic",
    badge: "Ultra Quality", // ◄ شارة تعكس فخامة وجودة الانتاج الحصرية
    isPremium: true,
    terms: "You will be charged a semi-annual subscription of $77.94 every 6 months (equivalent to $12.99/month). Unlocks exclusive 1080p Full HD Cinematic generation.",
  },
};

type PlanKey = "trial" | "quarterly" | "biannually";

export default function PricingPage() {
  // جعل باقة الـ 3 أيام هي الباقة المحددة تلقائياً لرفع نسبة التحويل (Conversion Rate) كما في لقطة الشاشة
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("trial");
  const [paymentInfo, setPaymentInfo] = useState({ rip: "", usdt: "" });
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualTransfer, setShowManualTransfer] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/payment-info")
      .then((res) => res.json())
      .then((data) => {
        setPaymentInfo({
          rip: data?.rip || "N/A",
          usdt: data?.usdt || "N/A",
        });
      })
      .catch(() => {
        setPaymentInfo({ rip: "N/A", usdt: "N/A" });
      });
  }, []);

  const goToCheckout = async (plan: PlanKey) => {
    try {
      setLoadingCheckout(true);
      setError(null);

      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }), // تمرير المعرف المحدث بدقة إلى الـ Backend
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid server response (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Checkout failed (${res.status})`);
      }

      if (!data?.url) {
        throw new Error("Checkout URL missing");
      }

      window.location.assign(data.url);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Checkout failed");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const currentPlanData = PLANS[selectedPlan];

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-start px-4 py-12 font-sans relative overflow-x-hidden">
      
      {/* حاوية الكاش أوت الرأسية المقتبسة من نمط DaVinci الاحترافي الفاخر */}
      <div className="w-full max-w-[440px] bg-[#0d0d0d] p-2 rounded-3xl flex flex-col mt-4">
        
        {/* 1. نصوص المقدمة */}
        <div className="text-left text-neutral-200 text-[15px] font-normal leading-relaxed px-2 mb-5">
          Full access to premium AI models, cinematic image generation, and video simulation.
        </div>

        {/* 2. شارة الدليل الاجتماعي المتحركة والديناميكية لجلب الثقة */}
        <div className="mx-auto bg-[#1a3a2a] text-[#34d399] text-xs font-bold px-4 py-1.5 rounded-full mb-4 text-center tracking-wide">
          ⚡ 4,852 people have used this offer today!
        </div>

        {/* 3. مجموعة الخيارات الرأسية (Vertical Stack Choices) */}
        <div className="flex flex-col gap-3 mb-5">
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const item = PLANS[key];
            const isSelected = selectedPlan === key;
            return (
              <div
                key={key}
                onClick={() => setSelectedPlan(key)}
                className={`border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "border-[#3b82f6] bg-[#0b1528] shadow-[inset_0_0_0_1px_#3b82f6]"
                    : "border-[#232326] bg-[#141416] hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* الراديو المخصص الذكي */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? "border-[#3b82f6] bg-[#3b82f6]" : "border-[#48484a]"
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  
                  {/* معلومات الخطة المحدثة بالجودة */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[16px] font-bold text-white">{item.name}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium w-fit transition-colors ${
                      item.isPremium 
                        ? "bg-emerald-500/10 text-emerald-400" 
                        : isSelected ? "bg-sky-500/10 text-sky-400" : "bg-[#232326] text-neutral-400"
                    }`}>
                      {item.quality}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full w-fit mt-0.5">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* سعر الباقة الموضح جهة اليمين */}
                <div className="text-right flex flex-col">
                  <span className="text-[17px] font-black text-white">{item.priceMain}</span>
                  <span className="text-[11px] text-neutral-500">{item.priceSub}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. الشروط القانونية التي تتغير بتغير الباقة المختارة تلقائياً لدعم الشفافية */}
        <div className="text-[12px] text-neutral-400 leading-relaxed px-2 mb-6">
          {currentPlanData.terms} By tapping Purchase, you agree to our{" "}
          <a href="#" className="underline text-neutral-300">Terms</a> and{" "}
          <a href="#" className="underline text-neutral-300">Refund Policy</a>.
        </div>

        {/* 5. قسم حساب السعر اللحظي المستحق الآن (Due Now) */}
        <div className="flex justify-between items-center px-2 mb-6">
          <span className="text-xl font-bold text-white">Due now</span>
          <span className="text-2xl font-black text-white tracking-tight">{currentPlanData.dueNowText}</span>
        </div>

        {/* عرض رسائل الخطأ إن وجدت */}
        {error && (
          <div className="mb-4 mx-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-red-300 text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* 6. أزرار الدفع والتحصيل الفوري والذكي */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => goToCheckout(selectedPlan)}
            disabled={loadingCheckout}
            className="w-full bg-[#2563eb] text-white py-3.5 rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg text-[15px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingCheckout ? "Processing secure network..." : "💳 Credit or debit card"}
          </button>

          <button 
            onClick={() => goToCheckout(selectedPlan)}
            disabled={loadingCheckout}
            className="w-full bg-[#ffc439] text-[#003087] py-3.5 rounded-xl font-bold italic text-lg hover:opacity-90 transition-all flex items-center justify-center"
          >
            PayPal
          </button>

          <button 
            onClick={() => goToCheckout(selectedPlan)}
            disabled={loadingCheckout}
            className="w-full bg-white text-black py-3.5 rounded-xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 text-[15px]"
          >
            G Pay
          </button>

          {/* زر التحويل اليدوي البديل (USDT / BaridiMob) المدمج بشكل مسطح وأنيق */}
          <button
            onClick={() => setShowManualTransfer(!showManualTransfer)}
            className="w-full bg-neutral-900 border border-neutral-800 text-neutral-400 py-3 rounded-xl font-semibold text-xs uppercase tracking-wider hover:text-white transition-all mt-2"
          >
            {showManualTransfer ? "▲ Hide Local Payments" : "▼ Use USDT or BaridiMob"}
          </button>
        </div>

        {/* حاوية بيانات التحويلات المحلية والعملات المشفرة إذا ضغط عليها العميل */}
        {showManualTransfer && (
          <div className="mt-4 p-4 rounded-2xl bg-[#141416] border border-[#232326] flex flex-col gap-4 animate-fade-in">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest text-center">
              Equivalent Local Total: {(currentPlanData.dzd).toLocaleString()} DZD
            </p>
            <div className="grid grid-cols-1 gap-3">
              <PaymentBox title="USDT Wallet Address" value={paymentInfo.usdt} />
              <PaymentBox title="BaridiMob (RIP)" value={paymentInfo.rip} />
            </div>
            <p className="text-[10px] text-neutral-500 text-center leading-normal">
              After transferring the amount manually, please send the transaction screenshot to our support team to activate your subscription instantly.
            </p>
          </div>
        )}

        <a href="/dashboard" className="text-center text-neutral-500 hover:text-neutral-300 text-xs mt-6 transition-colors font-medium">
          See all plans →
        </a>

      </div>

      {/* 7. قسم الأسئلة الشائعة الفاخر أسفل كارت الشراء لزيادة الموثوقية */}
      <div className="w-full max-w-[440px] mt-16 border-t border-neutral-800 pt-8">
        <h3 className="text-xl font-bold text-center mb-6">Frequently Asked Questions</h3>
        <div className="space-y-3">
          {[
            { q: "What is the difference in quality?", a: "The 3-Day access and Quarterly saver plans process rendering at 720p HD resolution using our ultra-fast engine. The 6-Month Cinematic plan unlocks full 1080p Full HD rendering utilizing advanced cinematic visual physics." },
            { q: "Can I cancel my subscription anytime?", a: "Yes, you can easily stop or cancel your subscription directly from your account settings at any time without any commitments." },
            { q: "Is card payment safe here?", a: "Completely safe. We handle all automated payments through Lemon Squeezy using standard banking security protocols and end-to-end data encryption." }
          ].map((item, index) => (
            <div key={index} className="bg-[#141416] border border-[#232326] rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full text-left p-4 font-medium text-[14px] text-white flex justify-between items-center hover:bg-neutral-800"
              >
                <span>{item.q}</span>
                <span className="text-neutral-500">{openFaq === index ? "−" : "+"}</span>
              </button>
              {openFaq === index && (
                <div className="p-4 pt-0 text-neutral-400 text-xs leading-relaxed border-t border-white/5 bg-[#141416]">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}

// دالة نسخ الـ RIP والمحفظة بكفاءة عالية
function PaymentBox({ title, value }: { title: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: any) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3 border border-neutral-800 rounded-xl bg-black flex flex-col justify-between gap-2">
      <div>
        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">{title}</p>
        <p className="text-xs font-mono break-all text-white font-medium select-all">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className="w-full bg-[#232326] text-white text-xs py-1.5 rounded-lg hover:bg-neutral-800 transition-colors font-medium"
      >
        {copied ? "Copied! ✓" : "Copy Info"}
      </button>
    </div>
  );
}