# CilikGo — Full-Screen Quiz Upgrade

Perubahan:
- Semua quiz Tahun 1 (BM, BI, Matematik, Sains) menggunakan satu engine yang sama.
- Paparan soalan penuh skrin.
- 4 pilihan A/B/C/D dalam grid 2 x 2.
- Bank lama yang mempunyai 3 pilihan mendapat satu pilihan neutral tambahan dan pilihan diacak.
- Butang Seterusnya kekal disabled sehingga jawapan betul.
- Tiada auto-next selepas jawapan betul.
- Jawapan salah: screen shake + red flash.
- Jawapan betul: green flash + pop + celebration.
- Audio Dengar diperbaiki dengan SpeechSynthesis.
- Bahasa Melayu/Matematik/Sains menggunakan `ms-MY`, rate 1.0, pitch 1.0.
- Sistem memilih suara `ms-MY` dahulu jika tersedia.
- Muzik latar dihentikan sementara ketika suara membaca soalan dan disambung semula selepas selesai.
- English menggunakan suara English.
- Tiada perubahan Firestore Rules.

Nota browser:
Browser memerlukan interaksi pengguna untuk memainkan suara. Butang Dengar ialah interaksi tersebut, jadi audio sepatutnya boleh dimainkan apabila Speech Synthesis tersedia pada peranti.
