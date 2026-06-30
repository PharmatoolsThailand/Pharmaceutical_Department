/* sw.js — Service Worker ขั้นต่ำ ให้เบราว์เซอร์ยอมให้ "ติดตั้งแอป" (PWA)
 * ไม่ทำ cache ซับซ้อน (กัน asset ค้าง) — แค่ผ่าน fetch ตามปกติ
 * ต้องเสิร์ฟผ่าน https หรือ localhost เท่านั้น · file:// ติดตั้งไม่ได้ */
const CACHE_NAME = "pharmacyhub-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
