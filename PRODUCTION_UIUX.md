# CilikGo — Production UI/UX Polish

Fasa ini sengaja tidak mengubah logik Firebase, CMS, referral, progress atau pembayaran yang sudah stabil.

Penambahbaikan:
- Sasaran sentuhan minimum yang lebih selesa pada butang.
- Focus state untuk keyboard/accessibility.
- Responsive dashboard Admin, Agent dan Penjaga.
- Sidebar bertukar menjadi navigasi mendatar sticky pada tablet/telefon.
- Jadual boleh discroll dengan lebih baik pada telefon.
- Modal/dialog lebih sesuai pada skrin kecil.
- Input 16px untuk mengelakkan auto-zoom pada telefon tertentu.
- Empty state lebih jelas.
- Hover/micro-interaction pada desktop.
- Reduced-motion support.
- Game answer button lebih besar untuk kanak-kanak.
- Toast dihadkan supaya tidak terkeluar skrin.
- Helper loading button disediakan untuk tindakan async akan datang.

## Ujian disyorkan
Uji pada:
1. Desktop.
2. Telefon sekitar 360–430px.
3. Admin dashboard.
4. Agent dashboard.
5. Penjaga dashboard.
6. Satu sesi permainan penuh.
7. CMS tambah/edit soalan.

Tiada perubahan Firestore Rules diperlukan untuk fasa UI/UX ini.
