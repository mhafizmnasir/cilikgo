# CMS Bank Soalan CilikGo

## Apa yang berubah
Admin kini boleh tambah, edit dan padam soalan bagi Membaca, Menulis dan Mengira untuk Level 1–3.

Setiap soalan mempunyai:
- Modul
- Level
- Soalan / paparan (teks atau emoji)
- 3 pilihan jawapan
- Jawapan betul
- Maklum balas apabila betul
- Susunan
- Status Aktif

## Bagaimana permainan memilih soalan
Apabila kanak-kanak membuka sesuatu Modul + Level:
1. CilikGo mencari soalan `active` dalam koleksi Firestore `questions`.
2. Jika ada soalan CMS, soalan tersebut digunakan.
3. Jika tiada, bank soalan terbina dalam digunakan sebagai fallback.

Ini bermaksud anda boleh menguji CMS sedikit demi sedikit tanpa kehilangan soalan asal.

## Selepas upload ke GitHub
WAJIB publish `firestore.rules` baharu di Firebase Console atau deploy:
`firebase deploy --only firestore:rules`

Tanpa rule baharu, Admin mungkin mendapat `Missing or insufficient permissions` apabila cuba simpan soalan.

## Cadangan
Masukkan sekurang-kurangnya 5 soalan aktif untuk setiap Modul + Level sebelum bergantung sepenuhnya pada CMS.
