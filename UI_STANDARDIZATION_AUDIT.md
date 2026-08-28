# CilikGo — UI Standardization & Error Audit

## Pembetulan utama
- Semua halaman subjek Tahun 1 kini menggunakan **satu renderer bersama**.
- Bahasa Melayu, Bahasa Inggeris, Matematik dan Sains tidak lagi mempunyai layout berasingan yang mudah menjadi tidak konsisten.
- Navbar subjek kini sama dengan Ruang Pelajar: `← Semua Subjek | CilikGo Pelajar | Profil Pelajar`.
- Semua halaman subjek mempunyai scroll container sendiri (`100dvh + overflow-y:auto`).
- Hero subjek, statistik, kad topik, progress bar, status penguasaan dan butang latihan distandardkan.
- Quiz modal menggunakan chip subjek dan gaya jawapan/progress yang sama.
- Admin dan Agent menerima spacing, sidebar, card radius dan background yang lebih konsisten dengan dashboard Penjaga/Pelajar.
- Beberapa teks lama “Modul 3M” pada status langganan pengguna ditukar kepada “latihan CilikGo”.

## Audit teknikal
- `node --check app.js`: LULUS
- Renderer subjek bersama: LULUS
- 4 wrapper subjek Tahun 1: LULUS
- Fungsi mula latihan BM/BI/Matematik/Sains: LULUS
- Auth modal lama tidak dirujuk lagi: LULUS
- ID HTML kritikal: LULUS
- Duplicate HTML IDs: TIADA

## Firestore
Tiada perubahan Firestore Rules diperlukan.

## Nota
Kod 3M lama masih dikekalkan sebagai legacy/fallback di belakang supaya data lama dan fungsi sedia ada tidak rosak. Ia tidak digunakan sebagai tema utama UI baharu.
