"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";

type PlanConfig = {
  id: string;
  planKey: string;
  name: string;
  credits: number;
  price: number;
  isPro: boolean;
  resolution: string;
  maxDurationSeconds: number;
  aiModel: string;
  advancedSampling: boolean;
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  watermarkText: string;
  priority: number;
};

const RESOLUTIONS = ["720p", "1080p"];

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans");
      if (res.status === 401 || res.status === 403) {
        setError("ليست لديك صلاحية الوصول لهذه الصفحة.");
        return;
      }
      if (!res.ok) {
        setError("تعذّر تحميل الباقات. حاول تحديث الصفحة.");
        return;
      }
      const data = await res.json();
      setPlans(data);
    } catch {
      setError("حدث خطأ في الاتصال بالسيرفر.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const updateField = (planKey: string, field: keyof PlanConfig, value: any) => {
    setPlans((prev) =>
      prev.map((p) => (p.planKey === planKey ? { ...p, [field]: value } : p))
    );
  };

  const savePlan = async (plan: PlanConfig) => {
    setSavingKey(plan.planKey);
    setSavedKey(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey: plan.planKey,
          name: plan.name,
          credits: Number(plan.credits),
          price: Number(plan.price),
          isPro: plan.isPro,
          resolution: plan.resolution,
          maxDurationSeconds: Number(plan.maxDurationSeconds),
          aiModel: plan.aiModel,
          advancedSampling: plan.advancedSampling,
          watermarkEnabled: plan.watermarkEnabled,
          watermarkOpacity: Number(plan.watermarkOpacity),
          watermarkText: plan.watermarkText,
          priority: Number(plan.priority),
        }),
      });

      if (res.ok) {
        setSavedKey(plan.planKey);
        setTimeout(() => setSavedKey(null), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`تعذّر الحفظ: ${data.error || "خطأ غير معروف"}`);
      }
    } catch {
      alert("حدث خطأ في الاتصال بالسيرفر أثناء الحفظ.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 space-y-8 font-sans" dir="rtl">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-yellow-400">
          إدارة الباقات ⚙️
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 hidden sm:inline">
            تعديل النقاط، الجودة، الموديل، والعلامة المائية لكل باقة مباشرة
          </span>
          <UserButton />
        </div>
      </div>

      {loading && (
        <p className="text-center text-gray-400 animate-pulse">جاري تحميل الباقات...</p>
      )}

      {error && (
        <div className="text-center p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/10 text-gray-400">
          لا توجد باقات في قاعدة البيانات بعد. شغّل سكربت{" "}
          <code className="text-yellow-400">prisma/seed-plan-config.ts</code> أولاً.
        </div>
      )}

      {!loading && !error && plans.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {plans
            .sort((a, b) => a.priority - b.priority)
            .map((plan) => (
              <div
                key={plan.planKey}
                className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4"
              >
                {/* اسم الباقة */}
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-xs text-gray-500 font-mono uppercase">
                    {plan.planKey}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      plan.isPro ? "bg-purple-900 text-purple-200" : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {plan.isPro ? "PRO" : "FREE TRIAL"}
                  </span>
                </div>

                {/* الاسم المعروض */}
                <Field label="اسم الباقة">
                  <input
                    type="text"
                    value={plan.name}
                    onChange={(e) => updateField(plan.planKey, "name", e.target.value)}
                    className="input"
                  />
                </Field>

                {/* النقاط والسعر */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="النقاط">
                    <input
                      type="number"
                      min={0}
                      value={plan.credits}
                      onChange={(e) => updateField(plan.planKey, "credits", e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="السعر ($)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={plan.price}
                      onChange={(e) => updateField(plan.planKey, "price", e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>

                {/* الجودة والمدة */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الجودة">
                    <select
                      value={plan.resolution}
                      onChange={(e) => updateField(plan.planKey, "resolution", e.target.value)}
                      className="input"
                    >
                      {RESOLUTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="مدة الفيديو (ثانية)">
                    <input
                      type="number"
                      min={1}
                      value={plan.maxDurationSeconds}
                      onChange={(e) =>
                        updateField(plan.planKey, "maxDurationSeconds", e.target.value)
                      }
                      className="input"
                    />
                  </Field>
                </div>

                {/* موديل الذكاء الاصطناعي */}
                <Field label="موديل Replicate">
                  <input
                    type="text"
                    value={plan.aiModel}
                    onChange={(e) => updateField(plan.planKey, "aiModel", e.target.value)}
                    className="input font-mono text-xs"
                    placeholder="wan-video/wan-2.5-t2v-fast"
                  />
                </Field>

                {/* أولوية الطابور */}
                <Field label="أولوية الطابور (0-10)">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={plan.priority}
                    onChange={(e) => updateField(plan.planKey, "priority", e.target.value)}
                    className="input"
                  />
                </Field>

                {/* checkboxes */}
                <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5">
                  <Checkbox
                    checked={plan.isPro}
                    onChange={(v) => updateField(plan.planKey, "isPro", v)}
                    label="باقة احترافية (Pro)"
                  />
                  <Checkbox
                    checked={plan.advancedSampling}
                    onChange={(v) => updateField(plan.planKey, "advancedSampling", v)}
                    label="جودة Sampling عالية"
                  />
                  <Checkbox
                    checked={plan.watermarkEnabled}
                    onChange={(v) => updateField(plan.planKey, "watermarkEnabled", v)}
                    label="تفعيل العلامة المائية"
                  />
                </div>

                {/* إعدادات العلامة المائية - تظهر فقط إذا كانت مفعّلة */}
                {plan.watermarkEnabled && (
                  <div className="grid grid-cols-2 gap-3 bg-black/30 p-3 rounded-xl">
                    <Field label="نص العلامة">
                      <input
                        type="text"
                        value={plan.watermarkText}
                        onChange={(e) =>
                          updateField(plan.planKey, "watermarkText", e.target.value)
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="الشفافية % (0-100)">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={plan.watermarkOpacity}
                        onChange={(e) =>
                          updateField(plan.planKey, "watermarkOpacity", e.target.value)
                        }
                        className="input"
                      />
                    </Field>
                  </div>
                )}

                {/* زر الحفظ */}
                <button
                  onClick={() => savePlan(plan)}
                  disabled={savingKey === plan.planKey}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl transition active:scale-95 text-sm"
                >
                  {savingKey === plan.planKey
                    ? "جاري الحفظ..."
                    : savedKey === plan.planKey
                    ? "✅ تم الحفظ"
                    : "حفظ التغييرات"}
                </button>
              </div>
            ))}
        </div>
      )}

      {/* أنماط مساعدة بسيطة للحقول */}
      <style jsx global>{`
        .input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: rgba(250, 204, 21, 0.5);
        }
      `}</style>
    </div>
  );
}

//////////////////////////////////////////////////
// 🧩 مكوّنات مساعدة صغيرة
//////////////////////////////////////////////////

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-yellow-400"
      />
      {label}
    </label>
  );
}
