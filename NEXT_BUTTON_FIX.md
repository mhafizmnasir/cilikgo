# CilikGo — Fix Butang Seterusnya

Punca yang ditemui:
- Butang menggunakan native HTML `disabled`.
- Kod juga memanggil `celebrate()` tetapi fungsi tersebut tiada, menghasilkan `ReferenceError` selepas jawapan betul.

Pembetulan:
- Native `disabled` pada Seterusnya dibuang.
- Status dikawal dengan class `locked` / `ready` dan `aria-disabled`.
- Selepas jawapan betul, butang dipaksa aktif dengan `removeAttribute('disabled')`.
- Handler klik tetap menghalang Next sebelum jawapan betul.
- `celebrate()` kini wujud dan memberi effect bintang.
- Selepas jawapan betul, butang Seterusnya discroll ke kawasan yang mudah dilihat.

Tiada perubahan Firestore Rules.
