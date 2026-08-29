# CilikGo Responsive All Sizes — V2 Fix

## Punca isu yang ditemui
Paparan kuiz mempunyai beberapa lapisan CSS responsive lama yang menggunakan gabungan `flex`, `grid`, `width:%`, breakpoint telefon dan breakpoint tablet. Pada lebar pertengahan seperti paparan tablet / Chrome Responsive Mode, `quiz-ref-main` kelihatan lebih lebar tetapi kandungan dalaman masih mewarisi geometri lama. Akibatnya scene, jawapan dan butang hanya memenuhi sebahagian skrin dan meninggalkan ruang kosong di sebelah kanan.

## Pembetulan
- Reset geometri `#gameModal`, `#gameContent` dan quiz shell kepada `100dvw × 100dvh`.
- `quiz-ref-main` kini mengira lebar terus daripada dynamic viewport (`dvw`) dan bukan daripada parent yang mungkin telah dikecilkan.
- Semua bahagian utama kuiz (`card`, scene, jawapan, feedback, Next) dipaksa `width:100%`, `min-width:0` dan `max-width:none` dalam container kuiz.
- Layout menggunakan grid fluid dengan `minmax()` dan `clamp()`.
- Telefon menggunakan geometri yang lebih padat tanpa membuat design khusus mengikut model peranti.
- Tablet menggunakan container penuh dan tidak lagi menjadi paparan telefon yang diletakkan di sebelah kiri.
- Skrin pendek dipadatkan berdasarkan `max-height`, bukan resolusi model peranti.
- Landscape menggunakan dua pane secara automatik apabila tinggi skrin terhad.
- Safe-area iPhone / notch dikekalkan.
- Favicon inline ditambah untuk menghapuskan ralat 404 favicon yang kelihatan dalam DevTools.

## Tidak diubah
- Bank soalan
- Logik jawapan
- Skor / progress
- Firebase
- Firestore Rules
- Role Penjaga / Admin / Agent
- Subscription
