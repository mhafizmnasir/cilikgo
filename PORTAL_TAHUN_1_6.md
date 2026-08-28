# CilikGo — Portal Tahun 1 hingga 6

Versi ini menggunakan struktur pembelajaran sekolah rendah:

Tahun → Subjek → Topik → Latihan

## Status kandungan
- Tahun 1: Bahasa Melayu, Bahasa Inggeris, Matematik dan Sains aktif.
- Tahun 2–6: struktur portal tersedia dan bank kandungan akan ditambah berperingkat.

## Perubahan
- Sistem pembelajaran lama dan bank soalannya dibuang daripada frontend.
- Admin menggunakan paparan Kandungan Tahun 1–6.
- Statistik utama hanya membaca rekod yang mempunyai `year` dan `subject`.
- Data sejarah Firestore tidak dipadam, tetapi tidak digunakan dalam portal baharu.
- Penjaga, Pelajar, Agent, Admin, langganan dan Firebase Auth dikekalkan.

Tiada perubahan Firestore Rules diperlukan.
