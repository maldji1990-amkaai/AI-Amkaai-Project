import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amkaai.app',
  appName: 'AMKAAI',
  webDir: 'out',
  server: {
    // 🚨 هذا السطر هو الأهم: لكي يفتح التطبيق موقعك المباشر فوراً بملء الشاشة
    url: 'https://www.amkaai.net',
    cleartext: true
  }
};

export default config;
