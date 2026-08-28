# CilikGo — Tetapan Penjaga

Perubahan:
- Navbar Penjaga kini: Ringkasan, Ruang Pelajar, Langganan, Tetapan.
- `Tambah Profil` dibuang daripada navbar.
- Fungsi Edit Profil dan Padam Profil dipindahkan ke Tetapan.
- Halaman Tetapan menyenaraikan semua profil dengan nama, tahun, jantina dan jumlah bintang.
- Edit menggunakan modal profil yang sama dan menyimpan melalui Firestore `updateDoc`.
- Padam profil turut membersihkan rekod progress.
- Butang `+ Tambah Anak` pada Ringkasan masih dikekalkan untuk akses cepat.
- Tetapan mempunyai butang `+ Tambah Profil` sendiri.

Tiada perubahan Firestore Rules tambahan diperlukan kerana rules versi sebelumnya sudah membenarkan owner mengemas kini profil dan memadam progress miliknya.
