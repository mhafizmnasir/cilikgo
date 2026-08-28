# CilikGo — Admin & Agent UI Fix Audit

## Masalah yang dibetulkan

### Agent
- Layout lama masih mempunyai `max-width: 1100px`, menyebabkan ruang kosong pada skrin besar.
- Sidebar/menu lama berubah menjadi `display:block` pada tablet dan boleh menyebabkan layout tidak konsisten.
- Menu `Settings` sebelum ini hanyalah pautan `#settings` dan tidak mempunyai view sebenar.
- Scroll kini berlaku di panel kandungan dashboard, bukan pada landing page.
- Ditambah view Tetapan Agent sebenar dan butang salin link referral.
- Semua menu menggunakan gaya Portal yang sama dengan Penjaga/Pelajar.
- Carian Referral dikekalkan dan paparan jadual dibuat responsive.

### Admin
- Layout Admin menggunakan shell lama dan boleh dipotong/kelihatan sempit pada resolusi tertentu.
- Sidebar dan content kini mempunyai sistem scroll yang jelas.
- Menu Admin distandardkan dengan ikon, label, active state dan responsive navigation.
- Paparan Profil Anak lama masih menunjukkan umur 4–6; kini ditukar kepada Profil Pelajar dan Tahun 1–6.
- Prestasi Pembelajaran lama hanya membaca data 3M; kini statistik utama membaca BM, BI, Matematik dan Sains melalui metadata `subject`.
- Carian Agent yang sebelum ini tidak berfungsi kini berfungsi untuk nama, e-mel dan kod Agent.
- CMS lama dilabel secara jelas sebagai `CMS Soalan 3M (Legacy)` supaya tidak disalah anggap sebagai CMS KSSR.
- Pengurusan Langganan menggunakan target `#adminContent` yang lebih stabil.

## Responsive
- Desktop: sidebar 238px + content penuh.
- Tablet: sidebar ikon 82px.
- Mobile: menu menjadi bar mendatar 58px dan content mempunyai scroll sendiri.
- Jadual mempunyai horizontal scroll tanpa memecahkan keseluruhan layout.

## Audit teknikal
- `node --check app.js`: LULUS
- Agent Settings view: LULUS
- Broken `#settings` link: DIHAPUSKAN
- Agent search / Admin Agent search: LULUS
- KSSR learning analytics: LULUS
- Firestore Rules: TIADA PERUBAHAN
