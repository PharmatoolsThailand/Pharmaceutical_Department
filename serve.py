"""Dev server สำหรับ Pharmacy Hub — กันปัญหา cache ของ file://
รันจากที่ไหนก็ได้:  py serve.py
เสิร์ฟโฟลเดอร์ Project (พาเรนต์) เพื่อให้ลิงก์แอพข้างเคียง (../HADCalculator ฯลฯ) ใช้ได้
ส่ง header no-store ทุก response → เปิด/รีเฟรชเห็นการแก้ทันที ไม่ต้อง hard refresh
"""
import http.server
import socketserver
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

PORT = 8765
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


with socketserver.TCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    url = f"http://127.0.0.1:{PORT}/PharmacyHub/index.html"
    print("Pharmacy Hub running (no-cache) -> " + url)
    print("Press Ctrl+C to stop")
    httpd.serve_forever()
