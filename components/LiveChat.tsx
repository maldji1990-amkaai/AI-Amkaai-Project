"use client";

import { useEffect } from "react";

export default function LiveChat() {
  useEffect(() => {
    // 1. تعريف مصفوفة كريسب في المتصفح
    (window as any).$crisp = [];
    
    // 🚨 استبدل هذا المعرف بالمعرف الخاص بموقعك بعد التسجيل في كريسب
    (window as any).CRISP_WEBSITE_ID = "ضع_هنا_الـ_WEBSITE_ID_الخاص_بك"; 

    // 2. حقن السكريبت ديناميكياً لتسريع تحميل الموقع
    const d = document;
    const s = d.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = true;
    d.getElementsByTagName("head")[0].appendChild(s);
  }, []);

  return null;
}