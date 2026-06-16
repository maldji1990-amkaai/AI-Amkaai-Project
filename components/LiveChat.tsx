"use client";

import { useEffect } from "react";

export default function LiveChat() {
  useEffect(() => {
    // إعداد كود Tawk.to ليعمل داخل React/Next.js
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    (window as any).Tawk_LoadStart = new Date();

    const s1 = document.createElement("script");
    const s0 = document.getElementsByTagName("script")[0];

    s1.async = true;
    s1.src = 'https://embed.tawk.to/6a31280d25dfec1d42f64729/1jr808tda';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');

    if (s0 && s0.parentNode) {
      s0.parentNode.insertBefore(s1, s0);
    } else {
      document.head.appendChild(s1);
    }
  }, []);

  return null;
}