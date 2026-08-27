# CilikGo — Learning System 2.0

## Perubahan utama
- Progression Level 1 → 2 → 3 kini berdasarkan **rekod terbaik setiap level**, bukan jumlah bintang daripada replay berulang.
- Untuk membuka level seterusnya, anak perlu mendapat sekurang-kurangnya **8/15 bintang** pada level sebelumnya.
- Level picker memaparkan rekod terbaik, status Lulus, jumlah bintang dan rank pembelajaran.
- Selepas lulus, ada butang **Level Seterusnya**.
- Jika belum lulus, CTA berubah kepada **Cuba Lagi**.
- Direct call ke `startLevel()` turut memeriksa unlock supaya level terkunci tidak boleh dipintas melalui UI.
- Subscription enforcement dikekalkan/dipulihkan: permainan progress hanya boleh dibuka apabila subscription aktif.
- Jika tiada profil anak dipilih, permainan tidak dimulakan.

## Rank
- 🌱 Mula Belajar
- 🌟 Pelajar Ceria
- 🏆 Bintang Hebat
- 👑 Juara 3M

## Nota progress lama
Rekod progress lama tidak dipadam. Sistem hanya mengambil skor terbaik bagi setiap level untuk menentukan unlock.

## UAT
1. Akaun aktif + pilih anak.
2. Level 1 terbuka; Level 2/3 terkunci untuk anak baru.
3. Skor <8 → Level 2 kekal terkunci.
4. Skor >=8 → Level 2 terbuka.
5. Replay Level 1 tidak menjumlahkan bintang untuk memintas Level 2/3.
6. Lulus Level 2 → Level 3 terbuka.
7. Akaun expired/inactive → paywall muncul.
8. Admin/Agent/Subscription sedia ada masih berfungsi.
