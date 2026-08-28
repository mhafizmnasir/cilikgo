# CilikGo — Utama + Report Kad + Fix Edit Profil

## Fix Simpan Perubahan
Punca sebenar: selepas profil ditambah/disimpan, `setButtonLoading()` meninggalkan butang Simpan dalam keadaan `disabled`. Apabila modal Edit dibuka kemudian, teks berubah kepada `Simpan Perubahan` tetapi butang masih disabled.

Fix:
- `prepareChildModal()` sentiasa reset disabled/loading state.
- `resetChildModal()` turut reset disabled/loading state.
- Edit profil menggunakan `setDoc(..., {merge:true})` untuk kemas kini yang stabil.

## Navbar Penjaga
Susunan baharu:
1. Utama
2. Report Kad
3. Ruang Pelajar
4. Langganan
5. Tetapan

`Ringkasan` ditukar kepada `Utama`.

## Report Kad
Tiga statistik yang sebelum ini berada pada Utama dipindahkan ke Report Kad:
- Profil pelajar
- Bintang anak dipilih
- Sesi direkodkan

Report Kad turut menunjukkan:
- Pelajar aktif
- Pilihan profil
- Prestasi BM, BI, Matematik dan Sains
- Sesi, topik dikuasai, skor terbaik dan jumlah bintang

## Firestore Rules
Rules turut diperbetulkan supaya Penjaga boleh memadam progress milik sendiri ketika memadam profil.

Deploy:
`firebase deploy --only firestore:rules`
