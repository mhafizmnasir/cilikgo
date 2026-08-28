# CilikGo — Matematik Tahun 1 Pilot

## Kandungan
60 soalan original CilikGo, 10 soalan bagi setiap topik:
1. Nombor hingga 100
2. Tambah & Tolak
3. Wang
4. Masa & Waktu
5. Ukuran & Sukatan
6. Bentuk & Data

Setiap sesi memilih 5 soalan secara rawak. Maksimum 15 bintang dan sasaran penguasaan ialah 8/15.

## Rekod Firestore
Kemajuan disimpan ke koleksi `progress` dengan metadata tambahan:
- `year: 1`
- `subject: "math"`
- `topic`
- `activity: "kssr_math_y1_<topic>"`
- `module: "KSSR Matematik Tahun 1"`

## Penting — Firestore Rules
Fasa 1 menukar profil anak kepada Tahun 1–6 tetapi rules lama masih mengehadkan `age` kepada 4–6.
Versi ini membetulkannya sambil mengekalkan keserasian profil 3M lama.

Selepas deploy kod, jalankan:
`firebase deploy --only firestore:rules`

## Sumber kurikulum
Struktur pilot merujuk hala tuju KSSR (Semakan 2017) dan Dokumen Penjajaran KSSR Edisi 3 bagi Matematik Tahap I.
Soalan adalah original CilikGo, bukan salinan atau dakwaan "soalan rasmi KPM".
