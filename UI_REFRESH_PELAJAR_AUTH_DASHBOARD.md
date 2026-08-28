# CilikGo — UI Refresh: Pelajar + Auth + Dashboard

## 1. Paparan Pelajar
- Pelajar bukan role Firebase baharu.
- Pelajar ialah **mode pembelajaran untuk profil anak** di bawah akaun Penjaga.
- Penjaga memilih profil anak dan tekan **Ruang Pelajar**.
- Paparan Pelajar mempunyai 4 kad subjek Tahun 1: Bahasa Melayu, Bahasa Inggeris, Matematik dan Sains.
- Soalan dipaparkan dalam dialog yang lebih besar, bersih dan fokus.
- Pelajar boleh kembali ke dashboard Penjaga melalui butang `← Penjaga`.

Kelebihan pendekatan ini: kanak-kanak tidak perlu mempunyai e-mel/kata laluan sendiri dan Firestore Rules sedia ada tidak perlu diubah.

## 2. Login / Daftar dipisahkan daripada landing page
URL hash:
- `#login` — halaman log masuk penuh.
- `#register` — halaman daftar penuh.
- `#dashboard` — portal selepas log masuk.
- `#student` — Ruang Pelajar.

Admin, Agent dan Penjaga menggunakan halaman login yang sama.
Pendaftaran hanya Penjaga atau Agent seperti sistem sedia ada.

## 3. Dashboard penuh
Selepas log masuk, pengguna tidak perlu scroll ke bahagian bawah landing page.
Dashboard dibuka sebagai paparan aplikasi penuh (`100dvh`).

- Penjaga: dashboard baru yang lebih ringkas, profil anak, quick stats, subjek dan butang Ruang Pelajar.
- Agent/Admin: dashboard sedia ada dikekalkan tetapi kini dibuka dalam paparan aplikasi penuh dengan kandungan scroll di dalam panel jika perlu.
- Bar atas aplikasi mempunyai Laman Utama dan Log Keluar.

## 4. Landing page
Mesej awam dikemas kini daripada fokus 3M kepada latihan Tahun 1–6.
Empat subjek Tahun 1 ditonjolkan.

## Firestore
Tiada perubahan Firestore Rules diperlukan untuk refresh UI ini.
