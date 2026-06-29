/* config.js — ค่าคงที่ + ข้อมูลตั้งต้น (seed)
 * registry จริงมาจาก Google Sheet ผ่าน Apps Script (ดู apps-script/SETUP.md)
 * seed ใช้ตอน: ยังไม่ได้ตั้ง APPS_SCRIPT_URL หรือโหลดออนไลน์ไม่ได้ */

window.HUB_CONFIG = {
  // วาง URL ของ Apps Script Web App ที่ deploy แล้ว (ลงท้าย /exec) — เว้นว่าง = ใช้ seed
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw90U11vjjhlybFwpunh9qOX9thMhjaUubhMvdcfRQ2MY28mFvAfuDr_CJFpUPdUoTu/exec",
  // รหัสทดสอบเฉพาะโหมด local (ยังไม่ได้ตั้ง APPS_SCRIPT_URL) — ของจริงตรวจที่ Apps Script (STAFF_TOKEN/ADMIN_TOKEN)
  LOCAL_STAFF_PW: "staff",
  LOCAL_ADMIN_PW: "admin",
  CACHE_KEY: "pharmacyHub.registry.v1",
  CACHE_TTL_MS: 1000 * 60 * 30,           // ถือว่า cache สดภายใน 30 นาที
  OPEN_IN_NEW_TAB: true
};

/* หมวดหมู่ตั้งต้น (ชีท Categories) — Admin เพิ่ม/แก้/ลบได้ในเมนูจัดการ
 * ใช้ชุดนี้เมื่อยังไม่มีข้อมูลหมวดในระบบ · 1 object = 1 แถว: id | name | icon | order */
window.CATS_SEED = [
  { id: "dosing", name: "คำนวณขนาดยา",      icon: "💊", order: 1 },
  { id: "forms",  name: "เอกสาร / ฟอร์ม",     icon: "📋", order: 2 },
  { id: "admin",  name: "ตารางงาน / บริหาร",  icon: "📅", order: 3 },
  { id: "tools",  name: "เครื่องมือ",          icon: "🧰", order: 4 },
  { id: "other",  name: "อื่น ๆ",             icon: "📦", order: 5 }
];

/* แอป (ชีท Apps) — ว่างไว้ เพิ่มจริงผ่านเมนูจัดการ/Google Sheet
 * โครงสร้าง 1 แถว: id | name | desc | category | icon | path | tags | status | public | order */
window.APPS_SEED = [];

/* ฐานข้อมูล & ระบบ (ชีท Docs) — ว่างไว้ เพิ่มจริงผ่านเมนูจัดการ/Google Sheet
 * โครงสร้าง 1 แถว: id | title | url | note | public | order */
window.DOCS_SEED = [];
