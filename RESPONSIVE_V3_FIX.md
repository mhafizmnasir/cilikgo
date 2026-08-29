# Responsive V3 Fix

Punca ralat pada skrin sempit (contoh 425px ke bawah) telah dikenal pasti.

## Punca sebenar
Beberapa rule responsive lama pada `max-width:430px` dan `max-width:380px` menetapkan:

`transform: scale(...)`

pada `.quiz-wood-board`.

Rule itu menggantikan `translate(-50%, -50%)` yang digunakan untuk memusatkan papan soalan. Akibatnya papan bermula dari titik 50% tetapi tidak ditarik semula ke tengah, lalu terkeluar ke sebelah kanan pada skrin sempit.

## Pembetulan
- Semua `scale-only transform` pada papan soalan dibuang/dibetulkan.
- Papan soalan kini sentiasa menggunakan `translate(-50%, -50%)`.
- Lebar papan menggunakan peratusan fluid dan `max-width` berdasarkan lebar scene.
- Elemen kuiz diberi `min-inline-size:0` dan `max-inline-size:100%` untuk mengelakkan overflow.
- Rule narrow phone menggunakan `100dvw` dan padding fluid.
- Rule short-screen mengecilkan scene secara menegak tanpa mengubah kedudukan mendatar papan.
- Favicon data URI ditambah untuk mengelakkan request `favicon.ico` 404 baru.

## QA
- `node --check app.js`: LULUS
- Tiada lagi `transform:scale(.95/.9/.82)` khusus pada `.quiz-wood-board`: LULUS
- Final center guard `translate(-50%,-50%)`: LULUS
- Tiada perubahan Firestore Rules.
