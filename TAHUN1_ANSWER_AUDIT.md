# CilikGo — Audit Jawapan Tahun 1

Jumlah disemak: **240 soalan**
- Bahasa Melayu: 60 soalan
- Bahasa Inggeris: 60 soalan
- Matematik: 60 soalan
- Sains: 60 soalan

## Punca utama ralat
Versi sebelumnya mempunyai 3 pilihan asal bagi banyak soalan. Sistem menambah pilihan ke-4 secara automatik dengan mengambil perkataan/jawapan daripada soalan lain dalam topik yang sama. Dalam soalan kategori seperti kata nama, benda hidup, haiwan dan sebagainya, pilihan tambahan itu kadang-kadang juga merupakan jawapan yang benar. Akibatnya pelajar boleh memilih jawapan yang secara fakta betul tetapi sistem menandanya salah.

## Pembetulan
- Semua 240 soalan kini mempunyai tepat **4 pilihan A/B/C/D yang eksplisit**.
- Pilihan ke-4 diaudit satu demi satu.
- Tiada lagi pilihan kosong.
- Tiada `Tidak pasti` / `Not sure`.
- Setiap `correct` mesti wujud dalam senarai jawapan.
- Tiada pilihan berulang dalam satu soalan.
- Sistem tidak lagi mengambil distractor rawak daripada soalan lain.
- Soalan Matematik Wang `Harga buku RM4, duit Siti RM5` yang sebelum ini mempunyai pilihan kosong telah dibetulkan.
- Pilihan BI `This is ___ apple` turut dibersihkan.

## QA
- `node --check app.js`: LULUS
- 4 pilihan unik untuk setiap soalan: LULUS
- Jawapan betul berada dalam pilihan: LULUS
- Pilihan kosong: TIADA
- Jumlah soalan: 240

Tiada perubahan Firestore Rules.
