# CilikGo — Unified Responsive All Sizes

Website kini menggunakan satu lapisan responsive fluid untuk semua saiz skrin, bukan reka bentuk berasingan bagi setiap model telefon.

## Prinsip
- `clamp()`, `min()`, `max()` dan unit viewport dinamik digunakan untuk saiz yang berubah secara fluid.
- Grid menggunakan `auto-fit` / `minmax()` supaya kolum menyesuaikan diri mengikut ruang sebenar.
- Hanya kategori layout umum digunakan: telefon, tablet, paparan besar, skrin pendek dan landscape.
- `viewport-fit=cover` ditambah untuk iPhone/notch/safe-area.
- Kuiz menggunakan ketinggian sebenar `100dvh` dan juga menyesuaikan diri berdasarkan **tinggi skrin**, bukan lebar sahaja.

## Meliputi
- Laman awam
- Dashboard Penjaga
- Dashboard Admin
- Dashboard Agent
- Ruang Pelajar
- Kad subjek / profil / report
- Jadual
- Dialog / borang
- Fullscreen kuiz
- Paparan landscape

Saiz khusus seperti 360×640 atau 390×844 kini hanya boleh digunakan untuk QA, bukan untuk menentukan reka bentuk berasingan.
